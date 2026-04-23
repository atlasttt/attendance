import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import ExcelJS from 'exceljs'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join as pathJoin } from 'path'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

// Получение папки для данных
function getAppDir() {
  const dir = pathJoin(homedir(), 'Library', 'Application Support', 'AttendanceTracker')
  mkdirSync(dir, { recursive: true })
  return dir
}

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

// IPC: выбор файлов (множественный)
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выберите Excel-файлы',
    filters: [
      { name: 'Excel files', extensions: ['xlsx'] },
      { name: 'All files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths
  }
  return []
})

// IPC: сканирование цветов из нескольких файлов
ipcMain.handle('scan-colors', async (event, filePaths) => {
  try {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { error: 'Не выбраны файлы', colors: [] }
    }

    const colorCounts = {}

    for (const filePath of filePaths) {
      try {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(filePath)
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
        console.error(`Ошибка сканирования ${filePath}:`, err.message)
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
})

// IPC: подсчёт по выбранным цветам (множественные файлы)
ipcMain.handle('count-selected', async (event, { filePaths, month, year, colors }) => {
  try {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return { error: 'Не выбраны файлы', results: [] }
    }

    const empMap = {}

    for (const filePath of filePaths) {
      try {
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(filePath)
        const worksheet = workbook.worksheets.length > 0 ? workbook.worksheets[0] : null

        if (!worksheet) continue

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
            }
            colors.forEach(c => empMap[key].colorCounts[c] = 0)
          }

          // Суммируем по цветам
          for (const c of colors) {
            empMap[key].colorCounts[c] += colorCounts[c]
          }

          if (!empMap[key].files.includes(filePath.split('/').pop())) {
            empMap[key].files.push(filePath.split('/').pop())
          }
        }
      } catch (err) {
        console.error(`Ошибка подсчёта ${filePath}:`, err.message)
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
})

// IPC: сохранение результатов в JSON
ipcMain.handle('save-results', async (event, results) => {
  try {
    const appDir = getAppDir()
    const resultsFile = pathJoin(appDir, 'attendance_results.json')
    
    let existing = []
    if (existsSync(resultsFile)) {
      const data = readFileSync(resultsFile, 'utf-8')
      existing = JSON.parse(data)
    }

    existing.push(...results)
    writeFileSync(resultsFile, JSON.stringify(existing, null, 2), 'utf-8')
    
    return { success: true, path: resultsFile }
  } catch (error) {
    return { error: error.message }
  }
})

// IPC: экспорт в Excel
ipcMain.handle('export-excel', async (event, results) => {
  try {
    if (!results || results.length === 0) {
      return { error: 'Нет данных для экспорта' }
    }

    const outputPath = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить результаты',
      defaultPath: `Результат_${results[0]?.month || ''}_${results[0]?.year || ''}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })

    if (outputPath.canceled) return { canceled: true }

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
        period: `${r.month}.${r.year}`,
        file: r.files?.[0] || '',
        date: r.date,
      }
      sortedCodes.forEach(code => {
        row[`color_${code}`] = r.colorCounts?.[code] || 0
      })
      worksheet.addRow(row)
    })

    await workbook.xlsx.writeFile(outputPath.filePath)

    return { success: true, path: outputPath.filePath }
  } catch (error) {
    return { error: error.message }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
