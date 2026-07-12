import { ipcMain, dialog, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDbPath, getDatabase, closeDatabase, initDatabase } from '../database.js';

export function registerDbIpc() {
  ipcMain.handle('db:export', async (_e, destDir?: string) => {
    try {
      const srcPath = getDbPath();
      if (!fs.existsSync(srcPath)) return { success: false, error: 'Database file not found' };

      const dir = destDir || app.getPath('desktop');
      const destPath = path.join(dir, `pos-backup.db`);

      // Clean up any old timestamped backup files (pos-backup-*.db)
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (/^pos-backup-.+\.db$/.test(file)) {
            fs.unlinkSync(path.join(dir, file));
          }
        }
      } catch { /* ignore cleanup errors */ }

      fs.copyFileSync(srcPath, destPath);
      return { success: true, path: destPath };
    } catch (err) {
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

      return { success: true, path: srcPath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
