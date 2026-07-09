import { ipcMain } from 'electron';
import * as vendorInvoiceRepo from '../repositories/vendorInvoiceRepository.js';
import { assertNonEmptyString, assertOptionalString, assertNonNegativeNumber, assertValidDateString, assertUUID } from '../validation.js';

export function registerVendorInvoiceIpc() {
  ipcMain.handle('vendor-invoices:list', (_e, status?: string, vendorId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => {
    assertOptionalString(status, 'status');
    assertOptionalString(vendorId, 'vendorId');
    assertOptionalString(dateFrom, 'dateFrom');
    assertOptionalString(dateTo, 'dateTo');
    return vendorInvoiceRepo.getAllVendorInvoices(status, vendorId, dateFrom, dateTo, page, limit);
  });

  ipcMain.handle('vendor-invoices:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return vendorInvoiceRepo.getVendorInvoiceById(id);
  });

  ipcMain.handle('vendor-invoices:get-with-items', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return vendorInvoiceRepo.getVendorInvoiceWithItems(id);
  });

  ipcMain.handle('vendor-invoices:create', (_e, vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, notes: string | undefined, items: unknown[]) => {
    assertUUID(vendorId, 'vendorId');
    assertNonEmptyString(invoiceNumber, 'invoiceNumber');
    assertValidDateString(issueDate, 'issueDate');
    assertValidDateString(dueDate, 'dueDate');
    assertNonNegativeNumber(subtotal, 'subtotal');
    assertNonNegativeNumber(taxAmount, 'taxAmount');
    assertNonNegativeNumber(discountAmount, 'discountAmount');
    assertNonNegativeNumber(total, 'total');
    assertNonNegativeNumber(paidAmount, 'paidAmount');
    assertOptionalString(notes, 'notes');
    const itemInputs = (items as { productId: string; quantity: number; ratePerUnit: number }[]).map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      ratePerUnit: item.ratePerUnit,
    }));
    return vendorInvoiceRepo.createVendorInvoice(vendorId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, notes, itemInputs);
  });

  ipcMain.handle('vendor-invoices:update', (_e, id: string, vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, status: string, notes?: string) => {
    assertNonEmptyString(id, 'id');
    assertUUID(vendorId, 'vendorId');
    assertNonEmptyString(invoiceNumber, 'invoiceNumber');
    assertValidDateString(issueDate, 'issueDate');
    assertValidDateString(dueDate, 'dueDate');
    assertNonNegativeNumber(subtotal, 'subtotal');
    assertNonNegativeNumber(taxAmount, 'taxAmount');
    assertNonNegativeNumber(discountAmount, 'discountAmount');
    assertNonNegativeNumber(total, 'total');
    assertNonNegativeNumber(paidAmount, 'paidAmount');
    assertNonEmptyString(status, 'status');
    assertOptionalString(notes, 'notes');
    return vendorInvoiceRepo.updateVendorInvoice(id, vendorId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, status, notes);
  });

  ipcMain.handle('vendor-invoices:replace-items', (_e, id: string, items: unknown[]) => {
    assertNonEmptyString(id, 'id');
    const itemInputs = (items as { productId: string; quantity: number; ratePerUnit: number }[]).map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      ratePerUnit: item.ratePerUnit,
    }));
    return vendorInvoiceRepo.replaceVendorInvoiceItems(id, itemInputs);
  });

  ipcMain.handle('vendor-invoices:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    vendorInvoiceRepo.softDeleteVendorInvoice(id);
    return { success: true };
  });

  ipcMain.handle('vendor-invoices:mark-paid', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return vendorInvoiceRepo.markVendorInvoiceAsPaid(id);
  });

  ipcMain.handle('vendor-invoices:summary', () => {
    return vendorInvoiceRepo.getVendorInvoicesSummary();
  });
}
