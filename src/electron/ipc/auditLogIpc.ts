import { ipcMain } from 'electron';
import { getAuditLogs } from '../repositories/auditLogRepository.js';

export function registerAuditLogIpc() {
  ipcMain.handle('audit-log:list', (_e, page?: number, limit?: number) => {
    return getAuditLogs(page ?? 1, limit ?? 20);
  });
}
