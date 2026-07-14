import { ipcMain, BrowserWindow } from 'electron';
import { runSync, runPullOnly, readLastSyncTime } from '../sync/syncEngine.js';
import type { SyncProgress } from '../sync/syncEngine.js';
import { createAuditLog } from '../repositories/auditLogRepository.js';
import { getOwner } from '../repositories/authRepository.js';

function sendProgress(event: Electron.IpcMainInvokeEvent, progress: SyncProgress): void {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.webContents.send('sync:progress', progress);
  }
}

export function registerSyncIpc() {
  ipcMain.handle('sync:run', async (event) => {
    const result = await runSync((progress) => sendProgress(event, progress));
    try {
      const user = getOwner();
      if (user) {
        const totalPushed = result.pushResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pushed ?? 0), 0);
        const totalPulled = result.pullResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pulled ?? 0), 0);
        const totalFailed = result.pushResults.reduce((s, r) => s + (r.failed ?? 0), 0) + 
                            result.pullResults.reduce((s, r) => s + (r.failed ?? 0), 0);
        const status = result.success ? 'success' : (totalFailed > 0 && (totalPushed + totalPulled) > 0 ? 'partial' : 'failure');
        const details = `Pushed: ${totalPushed}, Pulled: ${totalPulled}, Failed: ${totalFailed}, Attempts: ${result.attempts}`;
        createAuditLog('sync', status, user.id, user.full_name, details);
      }
    } catch { /* ignore audit errors */ }
    return result;
  });

  ipcMain.handle('sync:pull', async (event) => {
    const result = await runPullOnly((progress) => sendProgress(event, progress));
    try {
      const user = getOwner();
      if (user) {
        const totalPulled = result.pullResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pulled ?? 0), 0);
        const totalFailed = result.pullResults.reduce((s, r) => s + (r.failed ?? 0), 0);
        const status = result.success ? 'success' : 'failure';
        const details = `Pulled: ${totalPulled}, Failed: ${totalFailed}, Attempts: ${result.attempts}`;
        createAuditLog('pull', status, user.id, user.full_name, details);
      }
    } catch { /* ignore audit errors */ }
    return result;
  });

  ipcMain.handle('sync:last-time', () => {
    return readLastSyncTime();
  });
}
