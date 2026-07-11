import { ipcMain } from 'electron';
import * as vlRepo from '../repositories/vendorLedgerRepository.js';
import { assertNonEmptyString, assertOptionalString, assertPositiveNumber, assertNonNegativeNumber, assertValidDateString } from '../validation.js';

export function registerVendorLedgerIpc() {
  ipcMain.handle('vendor-ledger:list', (_e, vendorId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => {
    assertOptionalString(vendorId, 'vendor_id');
    assertOptionalString(dateFrom, 'date_from');
    assertOptionalString(dateTo, 'date_to');
    return vlRepo.getVendorLedgerEntries(vendorId, dateFrom, dateTo, page, limit);
  });

  ipcMain.handle('vendor-ledger:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return vlRepo.getVendorLedgerById(id);
  });

  ipcMain.handle('vendor-ledger:create', (_e, vendorId: string, productId: string, transactionDatetime: string,
    quantity: number, ratePerUnit: number, totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string) => {
    assertNonEmptyString(vendorId, 'vendor_id');
    assertNonEmptyString(productId, 'product_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    assertPositiveNumber(quantity, 'quantity');
    assertPositiveNumber(ratePerUnit, 'rate_per_unit');
    assertNonNegativeNumber(totalPayment, 'total_payment');
    assertNonNegativeNumber(paidAmount, 'paid_amount');
    assertOptionalString(description, 'description');
    assertOptionalString(vehicleNumber, 'vehicle_number');
    return vlRepo.createVendorLedgerEntry(vendorId, productId, transactionDatetime, quantity, ratePerUnit, totalPayment, paidAmount, description, vehicleNumber);
  });

  ipcMain.handle('vendor-ledger:update', (_e, id: string, vendorId: string, productId: string, transactionDatetime: string,
    quantity: number, ratePerUnit: number, totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(vendorId, 'vendor_id');
    assertNonEmptyString(productId, 'product_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    assertPositiveNumber(quantity, 'quantity');
    assertPositiveNumber(ratePerUnit, 'rate_per_unit');
    assertNonNegativeNumber(totalPayment, 'total_payment');
    assertNonNegativeNumber(paidAmount, 'paid_amount');
    assertOptionalString(description, 'description');
    assertOptionalString(vehicleNumber, 'vehicle_number');
    return vlRepo.updateVendorLedgerEntry(id, vendorId, productId, transactionDatetime, quantity, ratePerUnit, totalPayment, paidAmount, description, vehicleNumber);
  });

  ipcMain.handle('vendor-ledger:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    vlRepo.softDeleteVendorLedgerEntry(id);
    return { success: true };
  });

  ipcMain.handle('vendor-ledger:pending', (_e, vendorId: string) => {
    assertNonEmptyString(vendorId, 'vendor_id');
    return vlRepo.getPendingVendorLedgerEntries(vendorId);
  });

  ipcMain.handle('vendor-ledger:link-to-invoice', (_e, entryIds: string[], invoiceId: string) => {
    assertNonEmptyString(invoiceId, 'invoice_id');
    if (!Array.isArray(entryIds)) throw new Error('entryIds must be an array');
    vlRepo.linkEntriesToInvoice(entryIds, invoiceId);
    return { success: true };
  });
}
