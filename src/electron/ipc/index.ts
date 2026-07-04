import { ipcMain } from 'electron';
import { registerVendorIpc } from './vendorIpc.js';
import { registerCustomerIpc } from './customerIpc.js';
import { registerInventoryIpc } from './inventoryIpc.js';
import { registerVendorLedgerIpc } from './vendorLedgerIpc.js';
import { registerCustomerLedgerIpc } from './customerLedgerIpc.js';
import { registerExpenseIpc } from './expenseIpc.js';
import { registerDayClosingIpc } from './dayClosingIpc.js';
import { registerDashboardIpc } from './dashboardIpc.js';
import { registerAuthIpc } from './authIpc.js';

export function registerAllIpcHandlers() {
  registerAuthIpc();
  registerVendorIpc();
  registerCustomerIpc();
  registerInventoryIpc();
  registerVendorLedgerIpc();
  registerCustomerLedgerIpc();
  registerExpenseIpc();
  registerDayClosingIpc();
  registerDashboardIpc();
}
