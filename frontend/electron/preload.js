import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  scanColors: (filePaths) => ipcRenderer.invoke('scan-colors', filePaths),
  countSelected: (data) => ipcRenderer.invoke('count-selected', data),
  saveResults: (results) => ipcRenderer.invoke('save-results', results),
  exportExcel: (results) => ipcRenderer.invoke('export-excel', results),
})
