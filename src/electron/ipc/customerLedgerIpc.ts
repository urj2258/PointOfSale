import { ipcMain } from 'electron';
import * as clRepo from '../repositories/customerLedgerRepository.js';
import { assertNonEmptyString, assertOptionalString, assertPositiveNumber, assertNonNegativeNumber, assertValidDateString, assertName, assertPhone, assertAddress, handleIpcError } from '../validation.js';

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

  ipcMain.handle('customer-ledger:create-multi-item', (_e, customerData: any, saleData: any) => {
    try {
      if (!customerData?.id) {
        // Validate new customer fields
        assertName(customerData?.name, 'name');
        assertPhone(customerData?.phone, 'phone');
        assertAddress(customerData?.address, 'address');
      }

      assertValidDateString(saleData?.transactionDatetime, 'transaction_datetime');
      assertNonNegativeNumber(saleData?.totalPayment, 'total_payment');
      assertNonNegativeNumber(saleData?.paidAmount, 'paid_amount');
      
      if (!Array.isArray(saleData?.items) || saleData.items.length === 0) {
        throw new Error('At least one item is required.');
      }
      for (const item of saleData.items) {
        assertNonEmptyString(item.productId, 'product_id');
        assertPositiveNumber(item.quantity, 'quantity');
        assertPositiveNumber(item.ratePerUnit, 'rate_per_unit');
      }

      return clRepo.createMultiItemSale(
        {
          id: customerData.id,
          name: customerData.name?.trim() || '',
          phone: customerData.phone?.trim() || '',
          address: customerData.address?.trim() || '',
          shop_name: customerData.shop_name?.trim() || undefined,
        },
        {
          items: saleData.items,
          transactionDatetime: saleData.transactionDatetime,
          totalPayment: saleData.totalPayment,
          paidAmount: saleData.paidAmount,
          description: saleData.description || undefined,
          vehicleNumber: saleData.vehicleNumber || undefined,
          dueDate: saleData.dueDate || undefined,
        }
      );
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('customer-ledger:update-multi-item', (_e, id: string, customerId: string, saleData: any) => {
    try {
      assertNonEmptyString(id, 'id');
      assertNonEmptyString(customerId, 'customer_id');
      assertValidDateString(saleData?.transactionDatetime, 'transaction_datetime');
      assertNonNegativeNumber(saleData?.totalPayment, 'total_payment');
      assertNonNegativeNumber(saleData?.paidAmount, 'paid_amount');

      if (!Array.isArray(saleData?.items) || saleData.items.length === 0) {
        throw new Error('At least one item is required.');
      }
      for (const item of saleData.items) {
        assertNonEmptyString(item.productId, 'product_id');
        assertPositiveNumber(item.quantity, 'quantity');
        assertPositiveNumber(item.ratePerUnit, 'rate_per_unit');
      }

      return clRepo.updateMultiItemSale(
        id, customerId, saleData.transactionDatetime, saleData.items,
        saleData.totalPayment, saleData.paidAmount, saleData.description, saleData.vehicleNumber, saleData.dueDate
      );
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('customer-ledger:delete', (_e, id: string) => {
    try {
      assertNonEmptyString(id, 'id');
      clRepo.softDeleteCustomerLedgerEntry(id);
      return { success: true };
    } catch (err) {
      return handleIpcError(err);
    }
  });
  ipcMain.handle('customer-ledger:export-excel', async (_e, customerId: string, fromDate?: string, toDate?: string) => {
    try {
      assertNonEmptyString(customerId, 'customer_id');
      if (fromDate) assertValidDateString(fromDate, 'fromDate');
      if (toDate) assertValidDateString(toDate, 'toDate');

      const { buffer, filePath } = await clRepo.exportCustomerLedgerExcel(customerId, fromDate, toDate);
      
      const { canceled, filePath: savePath } = await import('electron').then(e => e.dialog.showSaveDialog({
        title: 'Export Customer Ledger',
        defaultPath: filePath,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      }));

      if (canceled || !savePath) return { canceled: true };
      
      const fs = await import('fs');
      fs.writeFileSync(savePath, buffer);
      return { success: true, path: savePath };
    } catch (err: any) {
      if (err.message === 'No entries found in this date range') {
        return { error: err.message };
      }
      return handleIpcError(err);
    }
  });
}
