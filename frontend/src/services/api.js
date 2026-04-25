// Сервис для работы с Excel в браузере
// Использует ExcelJS напрямую с File objects

import ExcelJS from 'exceljs'

// Определение названия цвета
function getColorName(code) {
  const upper = code.toUpperCase()

  const orange = ['FF9933', 'FFCC99', 'FFB366', 'FF8000', 'FFA500', 'FF9966']
  const blue = ['99CCFF', 'B3D9FF', '66B2FF', '0099FF', 'ADD8E6', '87CEEB']

  if (orange.includes(upper)) return 'Оранжевый'
  if (blue.includes(upper)) return 'Голубой'

  // Зелёные
  if (upper.startsWith('00') && upper[2] === '8' && upper[4] === '0') return 'Зелёный'
  // Красные
  if (upper[2] === '0' && upper[4] === '0' && parseInt(upper.slice(0, 2), 16) > 128) return 'Красный'
  // Жёлтые
  if (upper[4] === '0' && parseInt(upper.slice(0, 2), 16) > 200 && parseInt(upper.slice(2, 4), 16) > 200) return 'Жёлтый'

  return `Цвет #${upper}`
}

// Сканирование цветов из файлов
export async function scanColors(fileObjects) {
  try {
    if (!Array.isArray(fileObjects) || fileObjects.length === 0) {
      return { error: 'Не выбраны файлы', colors: [] }
    }

    const colorCounts = {}

    for (const file of fileObjects) {
      try {
        const buffer = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)
        const worksheet = workbook.worksheets.length > 0 ? workbook.worksheets[0] : null

        if (!worksheet) continue

        const maxRow = Math.min(worksheet.actualRowCount || 500, 500)
        const maxCol = Math.min(worksheet.actualColumnCount || 70, 70)

        for (let row = 3; row <= maxRow; row++) {
          const worksheetRow = worksheet.getRow(row)
          for (let col = 5; col <= maxCol; col++) {
            const cell = worksheetRow.getCell(col)
            const fill = cell.fill

            if (fill && fill.type === 'pattern' && fill.fgColor) {
              const color = typeof fill.fgColor.argb === 'string' ? fill.fgColor.argb : fill.fgColor
              if (color && color !== '00000000') {
                const hex = String(color).slice(-6)
                colorCounts[hex] = (colorCounts[hex] || 0) + 1
              }
            }
          }
        }
      } catch (err) {
        console.error(`Ошибка сканирования ${file.name}:`, err.message)
      }
    }

    // Форматируем результат
    const colors = Object.entries(colorCounts)
      .map(([code, count]) => ({
        code,
        hex: `#${code}`,
        name: getColorName(code),
        count,
      }))
      .sort((a, b) => b.count - a.count)

    return { colors }
  } catch (error) {
    return { error: error.message }
  }
}

// Подсчёт по выбранным цветам
export async function countSelected({ fileObjects, month, year, colors }) {
  try {
    if (!Array.isArray(fileObjects) || fileObjects.length === 0) {
      return { error: 'Не выбраны файлы', results: [] }
    }

    const empMap = {}
    let hoursColIndex = null
    let normColIndex = null

    for (const file of fileObjects) {
      try {
        const buffer = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(buffer)
        const worksheet = workbook.worksheets.length > 0 ? workbook.worksheets[0] : null

        if (!worksheet) continue

        // Ищем колонки с часами и нормой по заголовкам
        if (hoursColIndex === null || normColIndex === null) {
          const headerRow = worksheet.getRow(1)
          const maxCol = Math.min(worksheet.actualColumnCount || 70, 70)
          
          for (let col = 1; col <= maxCol; col++) {
            const cellValue = headerRow.getCell(col).value
            if (cellValue) {
              const str = String(cellValue).trim()
              
              if (str === 'Кол-во часов между входом и выходом') {
                hoursColIndex = col
              }
              if (str === 'Норма часов') {
                normColIndex = col
              }
            }
          }
        }

        const maxRow = Math.min(worksheet.actualRowCount || 1000, 1000)
        const maxCol = Math.min(worksheet.actualColumnCount || 70, 70)

        for (let row = 3; row <= maxRow; row++) {
          const worksheetRow = worksheet.getRow(row)
          const employee = worksheetRow.getCell(2).value
          const position = worksheetRow.getCell(3).value

          if (!employee) continue
          const empStr = String(employee)
          if (empStr.includes('Группа') || empStr.includes('Отдел') ||
              empStr.includes('Управление') || empStr.includes('Служба') ||
              empStr.includes('Департамент')) {
            continue
          }

          const empNum = worksheetRow.getCell(1).value
          if (typeof empNum !== 'number') continue

          // Считаем отдельно по каждому цвету
          const colorCounts = {}
          colors.forEach(c => colorCounts[c] = 0)

          for (let col = 5; col <= maxCol; col++) {
            const cell = worksheetRow.getCell(col)
            const fill = cell.fill

            if (fill && fill.type === 'pattern' && fill.fgColor) {
              const color = typeof fill.fgColor.argb === 'string' ? fill.fgColor.argb : fill.fgColor
              if (color && color !== '00000000') {
                const hex = String(color).slice(-6)
                if (colors.includes(hex)) {
                  colorCounts[hex] = (colorCounts[hex] || 0) + 1
                }
              }
            }
          }

          // Извлекаем часы и норму
          const hoursCell = hoursColIndex ? worksheetRow.getCell(hoursColIndex) : null
          const normCell = normColIndex ? worksheetRow.getCell(normColIndex) : null

          // Парсим формат "ЧЧ:ММ" в десятичные часы
          function parseTimeValueFromCell(cell) {
            if (!cell) return null
            
            const raw = cell.value
            
            if (raw === null || raw === undefined) return null
            
            // Проверяем Date (работает в любом context)
            function isDate(val) {
              return Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())
            }
            
            function dateToHours(date) {
              const base = Date.UTC(1899, 11, 30)
              const diffMs = date.getTime() - base
              const totalHours = diffMs / (1000 * 60 * 60)
              return Math.round(totalHours * 100) / 100
            }
            
            // Если Date (норма часов) — ПРОВЕРЯЕМ ПЕРВЫМ!
            if (isDate(raw)) {
              return dateToHours(raw)
            }
            
            // Если это object с formula/result (ExcelJS rich value)
            if (typeof raw === 'object') {
              // Если внутри result - Date
              if (isDate(raw.result)) {
                return dateToHours(raw.result)
              }
              
              // Если строка
              if (typeof raw === 'string') {
                const parts = raw.split(':')
                if (parts.length >= 2) {
                  const h = parseInt(parts[0]) || 0
                  const m = parseInt(parts[1]) || 0
                  return Math.round((h + m / 60) * 100) / 100
                }
              }
              
              return null
            }
            
            // Если просто число
            if (typeof raw === 'number') {
              if (raw > 0 && raw < 1) {
                return Math.round(raw * 24 * 100) / 100
              }
              return raw
            }
            
            return null
          }

          const parsedHours = parseTimeValueFromCell(hoursCell)
          const parsedNorm = parseTimeValueFromCell(normCell)

          const key = `${employee}|||${position}`
          if (!empMap[key]) {
            empMap[key] = {
              employee: String(employee),
              position: String(position || ''),
              colorCounts: {},
              month,
              year,
              files: [],
              date: new Date().toISOString().slice(0, 16).replace('T', ' '),
              hours: null,
              norm: null,
            }
            colors.forEach(c => empMap[key].colorCounts[c] = 0)
          }

          // Суммируем по цветам
          for (const c of colors) {
            empMap[key].colorCounts[c] += colorCounts[c]
          }

          // Сохраняем часы и норму (последнее значение)
          if (parsedHours !== null && parsedHours !== undefined) {
            empMap[key].hours = parsedHours
          }
          if (parsedNorm !== null && parsedNorm !== undefined) {
            empMap[key].norm = parsedNorm
          }

          if (!empMap[key].files.includes(file.name)) {
            empMap[key].files.push(file.name)
          }
        }
      } catch (err) {
        console.error(`Ошибка подсчёта ${file.name}:`, err.message)
      }
    }

    // Форматируем: делим на 2 и считаем total
    const results = Object.values(empMap).map(emp => {
      let total = 0
      const dividedCounts = {}
      for (const [color, count] of Object.entries(emp.colorCounts)) {
        dividedCounts[color] = Math.round(count / 2)
        total += dividedCounts[color]
      }
      return {
        ...emp,
        colorCounts: dividedCounts,
        count: total,
      }
    }).sort((a, b) => b.count - a.count)

    return { results, colorCodes: colors }
  } catch (error) {
    return { error: error.message }
  }
}

// Экспорт в Excel (скачивание файла)
export async function exportExcel(results) {
  try {
    if (!results || results.length === 0) {
      return { error: 'Нет данных для экспорта' }
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Результаты')

    // Определяем все уникальные коды цветов
    const colorCodes = new Set()
    results.forEach(r => {
      if (r.colorCounts) {
        Object.keys(r.colorCounts).forEach(c => colorCodes.add(c))
      }
    })
    const sortedCodes = Array.from(colorCodes).sort()

    // Формируем колонки
    const columns = [
      { header: 'Сотрудник', key: 'employee', width: 40 },
      { header: 'Должность', key: 'position', width: 30 },
    ]
    sortedCodes.forEach(code => {
      columns.push({ header: `#${code}`, key: `color_${code}`, width: 15 })
    })
    columns.push(
      { header: '% от нормы', key: 'percent', width: 15 },
      { header: 'Период', key: 'period', width: 12 },
      { header: 'Файл', key: 'file', width: 30 },
      { header: 'Дата', key: 'date', width: 20 },
    )

    worksheet.columns = columns

    // Добавляем строки
    results.forEach(r => {
      const row = {
        employee: r.employee,
        position: r.position,
        period: r.month && r.year ? `${r.month}.${r.year}` : '',
        file: Array.isArray(r.files) ? r.files[0] : (r.file || ''),
        date: r.date || '',
      }
      sortedCodes.forEach(code => {
        row[`color_${code}`] = r.colorCounts?.[code] || 0
      })
      
      // Процент от нормы
      if (r.hours !== null && r.hours !== undefined && r.norm && r.norm > 0) {
        row['percent'] = `${Math.round((r.hours / r.norm) * 100)}%`
      } else {
        row['percent'] = ''
      }
      
      worksheet.addRow(row)
    })

    // Генерируем файл и скачиваем
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `Результат_${results[0]?.month || ''}_${results[0]?.year || ''}.xlsx`
    document.body.appendChild(a)
    a.click()
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)

    return { success: true }
  } catch (error) {
    return { error: error.message }
  }
}

// Экспорт видимых данных (с трендами, как в таблице)
export async function exportVisibleExcel(results, colorCodes, periodValues, periodHours) {
  try {
    if (!results || results.length === 0) {
      return { error: 'Нет данных для экспорта' }
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Результаты')

    // Формируем колонки: Сотрудник, Должность, % от нормы, цвета, Total
    const columns = [
      { header: 'Сотрудник', key: 'employee', width: 40 },
      { header: 'Должность', key: 'position', width: 30 },
      { header: '% от нормы', key: 'percent', width: 25 },
    ]
    colorCodes.forEach(code => {
      columns.push({ header: `#${code}`, key: `color_${code}`, width: 20 })
    })
    columns.push({ header: 'Total', key: 'count', width: 10 })

    worksheet.columns = columns

    // Формируем строку с трендами для ячейки
    function formatCellValue(values) {
      if (!values || values.length === 0) return '0'
      if (values.length === 1) return String(values[0])

      let result = ''
      for (let i = 0; i < values.length; i++) {
        const val = values[i]
        if (i > 0) {
          const prev = values[i - 1]
          const d = val - prev
          if (d > 0) result += ' ↑ '
          else if (d < 0) result += ' ↓ '
          else result += ' → '
        }
        result += String(val)
      }
      return result
    }

    // Формируем процент от нормы с трендами
    function formatPercentValue(employee) {
      if (!periodHours || !periodHours[employee]) return ''
      const data = periodHours[employee]
      const percents = data.percent || []
      
      if (percents.length === 0) return ''
      if (percents.length === 1) return `${percents[0]}%`

      let result = ''
      for (let i = 0; i < percents.length; i++) {
        const p = percents[i]
        if (i > 0) {
          const prev = percents[i - 1]
          const d = p - prev
          if (d > 0) result += ' ↑ '
          else if (d < 0) result += ' ↓ '
          else result += ' → '
        }
        result += String(p) + '%'
      }
      return result
    }

    // Добавляем строки
    results.forEach(r => {
      const row = {
        employee: r.employee,
        position: r.position,
        count: r.count || 0,
        percent: formatPercentValue(r.employee),
      }
      colorCodes.forEach(code => {
        const values = periodValues[r.employee]?.[code] || []
        row[`color_${code}`] = formatCellValue(values)
      })
      worksheet.addRow(row)
    })

    // Генерируем файл и скачиваем
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `Результат_видимые_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)

    return { success: true }
  } catch (error) {
    return { error: error.message }
  }
}

export default {
  scanColors,
  countSelected,
  exportExcel,
  exportVisibleExcel,
}
