//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
let exceljs = require("exceljs");
exceljs = __toESM(exceljs);
let fs = require("fs");
let os = require("os");
//#region electron/main.js
var mainWindow;
function createWindow() {
	mainWindow = new electron.BrowserWindow({
		width: 1200,
		height: 900,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: (0, path.join)(__dirname, "preload.js")
		}
	});
	if (process.env.NODE_ENV === "development") {
		mainWindow.loadURL("http://localhost:5173");
		mainWindow.webContents.openDevTools();
	} else mainWindow.loadFile((0, path.join)(__dirname, "../dist/index.html"));
}
function getAppDir() {
	const dir = (0, path.join)((0, os.homedir)(), "Library", "Application Support", "AttendanceTracker");
	(0, fs.mkdirSync)(dir, { recursive: true });
	return dir;
}
function getColorName(code) {
	const upper = code.toUpperCase();
	const orange = [
		"FF9933",
		"FFCC99",
		"FFB366",
		"FF8000",
		"FFA500",
		"FF9966"
	];
	const blue = [
		"99CCFF",
		"B3D9FF",
		"66B2FF",
		"0099FF",
		"ADD8E6",
		"87CEEB"
	];
	if (orange.includes(upper)) return "Оранжевый";
	if (blue.includes(upper)) return "Голубой";
	if (upper.startsWith("00") && upper[2] === "8" && upper[4] === "0") return "Зелёный";
	if (upper[2] === "0" && upper[4] === "0" && parseInt(upper.slice(0, 2), 16) > 128) return "Красный";
	if (upper[4] === "0" && parseInt(upper.slice(0, 2), 16) > 200 && parseInt(upper.slice(2, 4), 16) > 200) return "Жёлтый";
	return `Цвет #${upper}`;
}
electron.ipcMain.handle("select-files", async () => {
	const result = await electron.dialog.showOpenDialog(mainWindow, {
		title: "Выберите Excel-файлы",
		filters: [{
			name: "Excel files",
			extensions: ["xlsx"]
		}, {
			name: "All files",
			extensions: ["*"]
		}],
		properties: ["openFile", "multiSelections"]
	});
	if (!result.canceled && result.filePaths.length > 0) return result.filePaths;
	return [];
});
electron.ipcMain.handle("scan-colors", async (event, filePaths) => {
	try {
		if (!Array.isArray(filePaths) || filePaths.length === 0) return {
			error: "Не выбраны файлы",
			colors: []
		};
		const colorCounts = {};
		for (const filePath of filePaths) try {
			const workbook = new exceljs.default.Workbook();
			await workbook.xlsx.readFile(filePath);
			const worksheet = workbook.worksheets.length > 0 ? workbook.worksheets[0] : null;
			if (!worksheet) continue;
			const maxRow = Math.min(worksheet.actualRowCount || 500, 500);
			const maxCol = Math.min(worksheet.actualColumnCount || 70, 70);
			for (let row = 3; row <= maxRow; row++) {
				const worksheetRow = worksheet.getRow(row);
				for (let col = 5; col <= maxCol; col++) {
					const fill = worksheetRow.getCell(col).fill;
					if (fill && fill.type === "pattern" && fill.fgColor) {
						const color = typeof fill.fgColor.argb === "string" ? fill.fgColor.argb : fill.fgColor;
						if (color && color !== "00000000") {
							const hex = String(color).slice(-6);
							colorCounts[hex] = (colorCounts[hex] || 0) + 1;
						}
					}
				}
			}
		} catch (err) {
			console.error(`Ошибка сканирования ${filePath}:`, err.message);
		}
		return { colors: Object.entries(colorCounts).map(([code, count]) => ({
			code,
			hex: `#${code}`,
			name: getColorName(code),
			count
		})).sort((a, b) => b.count - a.count) };
	} catch (error) {
		return { error: error.message };
	}
});
electron.ipcMain.handle("count-selected", async (event, { filePaths, month, year, colors }) => {
	try {
		if (!Array.isArray(filePaths) || filePaths.length === 0) return {
			error: "Не выбраны файлы",
			results: []
		};
		const empMap = {};
		for (const filePath of filePaths) try {
			const workbook = new exceljs.default.Workbook();
			await workbook.xlsx.readFile(filePath);
			const worksheet = workbook.worksheets.length > 0 ? workbook.worksheets[0] : null;
			if (!worksheet) continue;
			const maxRow = Math.min(worksheet.actualRowCount || 1e3, 1e3);
			const maxCol = Math.min(worksheet.actualColumnCount || 70, 70);
			for (let row = 3; row <= maxRow; row++) {
				const worksheetRow = worksheet.getRow(row);
				const employee = worksheetRow.getCell(2).value;
				const position = worksheetRow.getCell(3).value;
				if (!employee) continue;
				const empStr = String(employee);
				if (empStr.includes("Группа") || empStr.includes("Отдел") || empStr.includes("Управление") || empStr.includes("Служба") || empStr.includes("Департамент")) continue;
				if (typeof worksheetRow.getCell(1).value !== "number") continue;
				const colorCounts = {};
				colors.forEach((c) => colorCounts[c] = 0);
				for (let col = 5; col <= maxCol; col++) {
					const fill = worksheetRow.getCell(col).fill;
					if (fill && fill.type === "pattern" && fill.fgColor) {
						const color = typeof fill.fgColor.argb === "string" ? fill.fgColor.argb : fill.fgColor;
						if (color && color !== "00000000") {
							const hex = String(color).slice(-6);
							if (colors.includes(hex)) colorCounts[hex] = (colorCounts[hex] || 0) + 1;
						}
					}
				}
				const key = `${employee}|||${position}`;
				if (!empMap[key]) {
					empMap[key] = {
						employee: String(employee),
						position: String(position || ""),
						colorCounts: {},
						month,
						year,
						files: [],
						date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ")
					};
					colors.forEach((c) => empMap[key].colorCounts[c] = 0);
				}
				for (const c of colors) empMap[key].colorCounts[c] += colorCounts[c];
				if (!empMap[key].files.includes(filePath.split("/").pop())) empMap[key].files.push(filePath.split("/").pop());
			}
		} catch (err) {
			console.error(`Ошибка подсчёта ${filePath}:`, err.message);
		}
		return {
			results: Object.values(empMap).map((emp) => {
				let total = 0;
				const dividedCounts = {};
				for (const [color, count] of Object.entries(emp.colorCounts)) {
					dividedCounts[color] = Math.round(count / 2);
					total += dividedCounts[color];
				}
				return {
					...emp,
					colorCounts: dividedCounts,
					count: total
				};
			}).sort((a, b) => b.count - a.count),
			colorCodes: colors
		};
	} catch (error) {
		return { error: error.message };
	}
});
electron.ipcMain.handle("save-results", async (event, results) => {
	try {
		const resultsFile = (0, path.join)(getAppDir(), "attendance_results.json");
		let existing = [];
		if ((0, fs.existsSync)(resultsFile)) {
			const data = (0, fs.readFileSync)(resultsFile, "utf-8");
			existing = JSON.parse(data);
		}
		existing.push(...results);
		(0, fs.writeFileSync)(resultsFile, JSON.stringify(existing, null, 2), "utf-8");
		return {
			success: true,
			path: resultsFile
		};
	} catch (error) {
		return { error: error.message };
	}
});
electron.ipcMain.handle("export-excel", async (event, results) => {
	try {
		if (!results || results.length === 0) return { error: "Нет данных для экспорта" };
		const outputPath = await electron.dialog.showSaveDialog(mainWindow, {
			title: "Сохранить результаты",
			defaultPath: `Результат_${results[0]?.month || ""}_${results[0]?.year || ""}.xlsx`,
			filters: [{
				name: "Excel",
				extensions: ["xlsx"]
			}]
		});
		if (outputPath.canceled) return { canceled: true };
		const workbook = new exceljs.default.Workbook();
		const worksheet = workbook.addWorksheet("Результаты");
		const colorCodes = /* @__PURE__ */ new Set();
		results.forEach((r) => {
			if (r.colorCounts) Object.keys(r.colorCounts).forEach((c) => colorCodes.add(c));
		});
		const sortedCodes = Array.from(colorCodes).sort();
		const columns = [{
			header: "Сотрудник",
			key: "employee",
			width: 40
		}, {
			header: "Должность",
			key: "position",
			width: 30
		}];
		sortedCodes.forEach((code) => {
			columns.push({
				header: `#${code}`,
				key: `color_${code}`,
				width: 15
			});
		});
		columns.push({
			header: "Период",
			key: "period",
			width: 12
		}, {
			header: "Файл",
			key: "file",
			width: 30
		}, {
			header: "Дата",
			key: "date",
			width: 20
		});
		worksheet.columns = columns;
		results.forEach((r) => {
			const row = {
				employee: r.employee,
				position: r.position,
				period: `${r.month}.${r.year}`,
				file: r.files?.[0] || "",
				date: r.date
			};
			sortedCodes.forEach((code) => {
				row[`color_${code}`] = r.colorCounts?.[code] || 0;
			});
			worksheet.addRow(row);
		});
		await workbook.xlsx.writeFile(outputPath.filePath);
		return {
			success: true,
			path: outputPath.filePath
		};
	} catch (error) {
		return { error: error.message };
	}
});
electron.app.whenReady().then(createWindow);
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
	if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
//#endregion
