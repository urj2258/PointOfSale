import { ipcMain } from 'electron';
import * as invoiceRepo from '../repositories/invoiceRepository.js';
import { assertNonEmptyString, assertOptionalString, assertNonNegativeNumber, assertValidDateString, assertUUID, handleIpcError } from '../validation.js';

export function registerInvoiceIpc() {
  ipcMain.handle('invoices:list', (_e, status?: string, customerId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => {
    assertOptionalString(status, 'status');
    assertOptionalString(customerId, 'customerId');
    assertOptionalString(dateFrom, 'dateFrom');
    assertOptionalString(dateTo, 'dateTo');
    return invoiceRepo.getAllInvoices(status, customerId, dateFrom, dateTo, page, limit);
  });

  ipcMain.handle('invoices:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return invoiceRepo.getInvoiceById(id);
  });

  ipcMain.handle('invoices:get-with-items', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return invoiceRepo.getInvoiceWithItems(id);
  });

  ipcMain.handle('invoices:create', (_e, customerId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, notes: string | undefined, items: unknown[]) => {
    try {
      assertUUID(customerId, 'customerId');
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
      return invoiceRepo.createInvoice(customerId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, notes, itemInputs);
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('invoices:update', (_e, id: string, customerId: string, invoiceNumber: string, issueDate: string, dueDate: string, subtotal: number, taxAmount: number, discountAmount: number, total: number, paidAmount: number, status: string, notes?: string) => {
    assertNonEmptyString(id, 'id');
    assertUUID(customerId, 'customerId');
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
    return invoiceRepo.updateInvoice(id, customerId, invoiceNumber, issueDate, dueDate, subtotal, taxAmount, discountAmount, total, paidAmount, status, notes);
  });

  ipcMain.handle('invoices:replace-items', (_e, id: string, items: unknown[]) => {
    assertNonEmptyString(id, 'id');
    const itemInputs = (items as { productId: string; quantity: number; ratePerUnit: number }[]).map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      ratePerUnit: item.ratePerUnit,
    }));
    return invoiceRepo.replaceInvoiceItems(id, itemInputs);
  });

  ipcMain.handle('invoices:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    invoiceRepo.softDeleteInvoice(id);
    return { success: true };
  });

  ipcMain.handle('invoices:mark-paid', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return invoiceRepo.markInvoiceAsPaid(id);
  });

  ipcMain.handle('invoices:summary', () => {
    return invoiceRepo.getInvoicesSummary();
  });
}
