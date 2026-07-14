import { ipcMain, dialog, app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDbPath, getDatabase, closeDatabase, initDatabase } from '../database.js';
import { clearSyncMeta } from '../sync/syncEngine.js';
import { createAuditLog } from '../repositories/auditLogRepository.js';
import { getOwner } from '../repositories/authRepository.js';

let lastExportLogTime = 0;

export function registerDbIpc() {
  ipcMain.handle('db:export', async (_e, destDir?: string) => {
    try {
      const srcPath = getDbPath();
      if (!fs.existsSync(srcPath)) return { success: false, error: 'Database file not found' };

      const db = getDatabase();
      db.pragma('wal_checkpoint(TRUNCATE)');

      const dir = destDir || app.getPath('desktop');
      
      // 1. Find and delete old backups to avoid clutter
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith('pos-backup') && file.endsWith('.db')) {
            const oldBackupPath = path.join(dir, file);
            fs.unlinkSync(oldBackupPath);
          }
        }
      } catch (err) {
        // Ignore folder read errors
      }

      // 2. Generate a human-readable timestamp (e.g., "Jul-13-2026-9-20-PM")
      const now = new Date();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[now.getMonth()];
      const day = String(now.getDate()).padStart(2, '0');
      const year = now.getFullYear();
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12; // convert 0 to 12
      const mins = String(now.getMinutes()).padStart(2, '0');
      
      const dateStr = `${month}-${day}-${year}-${hours}-${mins}-${ampm}`;
      const destPath = path.join(dir, `pos-backup-${dateStr}.db`);

      fs.copyFileSync(srcPath, destPath);

      try {
        const user = getOwner();
        const currentMs = Date.now();
        if (user && (currentMs - lastExportLogTime > 60000)) {
          createAuditLog('export', 'success', user.id, user.full_name, `Exported to: ${destPath}`);
          lastExportLogTime = currentMs;
        }
      } catch { /* ignore audit errors */ }

      return { success: true, path: destPath };
    } catch (err) {
      try {
        const user = getOwner();
        if (user) createAuditLog('export', 'failure', user.id, user.full_name, String(err));
      } catch { /* ignore audit errors */ }
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db:select-export-path', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Export Directory',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { path: result.filePaths[0] };
  });

  ipcMain.handle('db:import', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Database Backup',
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const srcPath = result.filePaths[0];
      const dbPath = getDbPath();

      closeDatabase();
      fs.copyFileSync(srcPath, dbPath);
      initDatabase();

      const db = getDatabase();
      const tables = ['vendors', 'customers', 'inventory', 'vendor_ledger', 'vendor_invoices', 'vendor_invoice_items', 'customer_ledger', 'invoices', 'invoice_items', 'expense_categories', 'expenses', 'day_closing_reports', 'users'];
      for (const table of tables) {
        db.prepare(`UPDATE ${table} SET synced = 0`).run();
      }
      
      // Wipe the sync tracker file so the system doesn't assume it is already up to date
      clearSyncMeta();

      try {
        const user = getOwner();
        if (user) createAuditLog('import', 'success', user.id, user.full_name, `Imported from: ${srcPath}`);
      } catch { /* ignore audit errors */ }

      return { success: true, path: srcPath };
    } catch (err) {
      try {
        const user = getOwner();
        if (user) createAuditLog('import', 'failure', user.id, user.full_name, String(err));
      } catch { /* ignore audit errors */ }
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db:nuke', async () => {
    try {
      const dbPath = getDbPath();
      const syncMetaPath = path.join(app.getPath('userData'), 'sync-meta.json');
      const errorLogPath = path.join(app.getPath('userData'), 'sync-errors.log');

      closeDatabase();

      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
      if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
      if (fs.existsSync(syncMetaPath)) fs.unlinkSync(syncMetaPath);
      if (fs.existsSync(errorLogPath)) fs.unlinkSync(errorLogPath);

      initDatabase();

      try {
        const user = getOwner();
        if (user) createAuditLog('nuke', 'success', user.id, user.full_name, 'Local database wiped');
      } catch { /* ignore audit errors */ }

      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('db:open-sync-log-dir', async () => {
    const logPath = path.join(path.dirname(getDbPath()), 'sync-errors.log');
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });
}
