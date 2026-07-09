import { ipcMain } from 'electron';
import { runSync, runPullOnly, readLastSyncTime } from '../sync/syncEngine.js';

export function registerSyncIpc() {
  ipcMain.handle('sync:run', () => {
    return runSync();
  });

  ipcMain.handle('sync:pull', () => {
    return runPullOnly();
  });

  ipcMain.handle('sync:last-time', () => {
    return readLastSyncTime();
  });
}
