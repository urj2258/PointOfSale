import { ipcMain, dialog, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDbPath, getDatabase, closeDatabase, initDatabase } from '../database.js';

export function registerDbIpc() {
  ipcMain.handle('db:export', async () => {
    try {
      const srcPath = getDbPath();
      if (!fs.existsSync(srcPath)) return { success: false, error: 'Database file not found' };

      const desktop = app.getPath('desktop');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destPath = path.join(desktop, `pos-backup-${timestamp}.db`);

      fs.copyFileSync(srcPath, destPath);
      return { success: true, path: destPath };
    } catch (err) {
      return { success: false, error: String(err) };
    }
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
