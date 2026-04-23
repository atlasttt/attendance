// IPC сервис для Electron
// Все вызовы идут через window.electronAPI (preload.js)

export async function scanColors(filePath) {
  const result = await window.electronAPI.scanColors(filePath)
  if (result.error) throw new Error(result.error)
  return result
}

export async function countSelected(data) {
  const result = await window.electronAPI.countSelected(data)
  if (result.error) throw new Error(result.error)
  return result
}

export async function saveResults(results) {
  const result = await window.electronAPI.saveResults(results)
  if (result.error) throw new Error(result.error)
  return result
}

export async function exportExcel(results) {
  const result = await window.electronAPI.exportExcel(results)
  if (result.error) throw new Error(result.error)
  return result
}

export default {
  scanColors,
  countSelected,
  saveResults,
  exportExcel,
}
