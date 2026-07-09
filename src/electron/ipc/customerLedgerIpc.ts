import { ipcMain } from 'electron';
import * as clRepo from '../repositories/customerLedgerRepository.js';
import { assertNonEmptyString, assertOptionalString, assertPositiveNumber, assertNonNegativeNumber, assertValidDateString } from '../validation.js';

export function registerCustomerLedgerIpc() {
  ipcMain.handle('customer-ledger:list', (_e, customerId?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number) => {
    assertOptionalString(customerId, 'customer_id');
    assertOptionalString(dateFrom, 'date_from');
    assertOptionalString(dateTo, 'date_to');
    return clRepo.getCustomerLedgerEntries(customerId, dateFrom, dateTo, page, limit);
  });

  ipcMain.handle('customer-ledger:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return clRepo.getCustomerLedgerById(id);
  });

  ipcMain.handle('customer-ledger:create', (_e, customerId: string, productId: string, transactionDatetime: string,
    quantity: number, ratePerUnit: number, totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string) => {
    assertNonEmptyString(customerId, 'customer_id');
    assertNonEmptyString(productId, 'product_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    assertPositiveNumber(quantity, 'quantity');
    assertPositiveNumber(ratePerUnit, 'rate_per_unit');
    assertNonNegativeNumber(totalPayment, 'total_payment');
    assertNonNegativeNumber(paidAmount, 'paid_amount');
    assertOptionalString(description, 'description');
    assertOptionalString(vehicleNumber, 'vehicle_number');
    return clRepo.createCustomerLedgerEntry(customerId, productId, transactionDatetime, quantity, ratePerUnit, totalPayment, paidAmount, description, vehicleNumber);
  });

  ipcMain.handle('customer-ledger:update', (_e, id: string, customerId: string, productId: string, transactionDatetime: string,
    quantity: number, ratePerUnit: number, totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(customerId, 'customer_id');
    assertNonEmptyString(productId, 'product_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    assertPositiveNumber(quantity, 'quantity');
    assertPositiveNumber(ratePerUnit, 'rate_per_unit');
    assertNonNegativeNumber(totalPayment, 'total_payment');
    assertNonNegativeNumber(paidAmount, 'paid_amount');
    assertOptionalString(description, 'description');
    assertOptionalString(vehicleNumber, 'vehicle_number');
    return clRepo.updateCustomerLedgerEntry(id, customerId, productId, transactionDatetime, quantity, ratePerUnit, totalPayment, paidAmount, description, vehicleNumber);
  });

  ipcMain.handle('customer-ledger:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    clRepo.softDeleteCustomerLedgerEntry(id);
    return { success: true };
  });
}
