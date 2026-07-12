import { ipcMain } from 'electron';
import { runSync, runPullOnly, readLastSyncTime } from '../sync/syncEngine.js';
import { createAuditLog } from '../repositories/auditLogRepository.js';
import { getOwner } from '../repositories/authRepository.js';

export function registerSyncIpc() {
  ipcMain.handle('sync:run', async () => {
    const result = await runSync();
    try {
      const user = getOwner();
      if (user) {
        const totalPushed = result.pushResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pushed ?? 0), 0);
        const totalPulled = result.pullResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pulled ?? 0), 0);
        const totalFailed = result.pushResults.reduce((s, r) => s + (r.failed ?? 0), 0) + 
                            result.pullResults.reduce((s, r) => s + (r.failed ?? 0), 0);
        const status = result.success ? 'success' : (totalFailed > 0 && (totalPushed + totalPulled) > 0 ? 'partial' : 'failure');
        const details = `Pushed: ${totalPushed}, Pulled: ${totalPulled}, Failed: ${totalFailed}`;
        createAuditLog('sync', status, user.id, user.full_name, details);
      }
    } catch { /* ignore audit errors */ }
    return result;
  });

  ipcMain.handle('sync:pull', async () => {
    const result = await runPullOnly();
    try {
      const user = getOwner();
      if (user) {
        const totalPulled = result.pullResults.filter(r => r.table !== 'audit_logs').reduce((s, r) => s + (r.pulled ?? 0), 0);
        const totalFailed = result.pullResults.reduce((s, r) => s + (r.failed ?? 0), 0);
        const status = result.success ? 'success' : 'failure';
        const details = `Pulled: ${totalPulled}, Failed: ${totalFailed}`;
        createAuditLog('pull', status, user.id, user.full_name, details);
      }
    } catch { /* ignore audit errors */ }
    return result;
  });

  ipcMain.handle('sync:last-time', () => {
    return readLastSyncTime();
  });
}
