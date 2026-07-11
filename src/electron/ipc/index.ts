import { ipcMain } from 'electron';
import { registerVendorIpc } from './vendorIpc.js';
import { registerCustomerIpc } from './customerIpc.js';
import { registerInventoryIpc } from './inventoryIpc.js';
import { registerVendorLedgerIpc } from './vendorLedgerIpc.js';
import { registerCustomerLedgerIpc } from './customerLedgerIpc.js';
import { registerInvoiceIpc } from './invoiceIpc.js';
import { registerVendorInvoiceIpc } from './vendorInvoiceIpc.js';
import { registerExpenseIpc } from './expenseIpc.js';
import { registerDayClosingIpc } from './dayClosingIpc.js';
import { registerDashboardIpc } from './dashboardIpc.js';
import { registerAuthIpc } from './authIpc.js';
import { registerSyncIpc } from './syncIpc.js';
import { registerDbIpc } from './dbIpc.js';
export function registerAllIpcHandlers() {
  registerAuthIpc();
  registerSyncIpc();
  registerDbIpc();
  registerVendorIpc();
  registerCustomerIpc();
  registerInventoryIpc();
  registerVendorLedgerIpc();
  registerCustomerLedgerIpc();
  registerVendorInvoiceIpc();
  registerInvoiceIpc();
  registerExpenseIpc();
  registerDayClosingIpc();
  registerDashboardIpc();
}
