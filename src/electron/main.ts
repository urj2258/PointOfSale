import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path'
import { isDev } from './utils.js';
import { getPreloadPath } from './pathResolver.js';
import { initDatabase, closeDatabase } from './database.js';
import { registerAllIpcHandlers } from './ipc/index.js';

let win: BrowserWindow | null = null

const createWindow = () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: !app.isPackaged,
    titleBarStyle: app.isPackaged ? 'hidden' : undefined,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  if (isDev()) {
    win.loadURL('http://localhost:5132');
  } else {
    win.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
  }
}

ipcMain.on('window:minimize', () => {
  win?.minimize()
})

ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window:close', () => {
  win?.close()
})

app.whenReady().then(() => {
  initDatabase()
  registerAllIpcHandlers()
  createWindow()
})

app.on('before-quit', () => {
  closeDatabase()
})
