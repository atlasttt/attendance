let electron = require("electron");
//#region electron/preload.js
electron.contextBridge.exposeInMainWorld("electronAPI", {
	selectFiles: () => electron.ipcRenderer.invoke("select-files"),
	scanColors: (filePaths) => electron.ipcRenderer.invoke("scan-colors", filePaths),
	countSelected: (data) => electron.ipcRenderer.invoke("count-selected", data),
	saveResults: (results) => electron.ipcRenderer.invoke("save-results", results),
	exportExcel: (results) => electron.ipcRenderer.invoke("export-excel", results)
});
//#endregion
