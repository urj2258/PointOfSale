import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import * as dayClosingRepo from '../repositories/dayClosingRepository.js';
import * as vlRepo from '../repositories/vendorLedgerRepository.js';
import { assertNonEmptyString, assertOptionalString, assertPositiveNumber, assertNonNegativeNumber, assertValidDateString, assertName, assertPhone, assertAddress, assertNumber, handleIpcError } from '../validation.js';

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

  ipcMain.handle('vendor-ledger:create', (_e, vendorId: string, transactionDatetime: string,
    items: { productId: string; quantity: number; ratePerUnit: number }[],
    totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string, dueDate?: string,
    transactionType?: string, taggedCustomerId?: string) => {
    const tt = transactionType || 'purchase';
    assertNonEmptyString(vendorId, 'vendor_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    if (tt === 'payment') {
      // Payment entries: items/vehicle not required
      assertNonNegativeNumber(totalPayment, 'total_payment');
      assertNonNegativeNumber(paidAmount, 'paid_amount');
      assertOptionalString(description, 'description');
      if (taggedCustomerId) {
        assertNonEmptyString(taggedCustomerId, 'tagged_customer_id');
        return vlRepo.createVendorPaymentWithCustomerRef(
          vendorId, transactionDatetime, paidAmount, description || '', taggedCustomerId
        );
      }
      return vlRepo.createVendorLedgerEntry(vendorId, transactionDatetime, items, totalPayment, paidAmount, description, undefined, undefined, 'payment');
    }
    if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item is required');
    for (const item of items) {
      assertNonEmptyString(item.productId, 'product_id');
      assertPositiveNumber(item.quantity, 'quantity');
      assertPositiveNumber(item.ratePerUnit, 'rate_per_unit');
    }
    assertNonNegativeNumber(totalPayment, 'total_payment');
    assertNonNegativeNumber(paidAmount, 'paid_amount');
    assertOptionalString(description, 'description');
    assertOptionalString(vehicleNumber, 'vehicle_number');
    assertOptionalString(dueDate, 'due_date');
    return vlRepo.createVendorLedgerEntry(vendorId, transactionDatetime, items, totalPayment, paidAmount, description, vehicleNumber, dueDate, 'purchase');
  });

  ipcMain.handle('vendor-ledger:update', (_e, id: string, vendorId: string, transactionDatetime: string,
    items: { productId: string; quantity: number; ratePerUnit: number }[],
    totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string, dueDate?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(vendorId, 'vendor_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item is required');
    for (const item of items) {
      assertNonEmptyString(item.productId, 'product_id');
      assertPositiveNumber(item.quantity, 'quantity');
      assertPositiveNumber(item.ratePerUnit, 'rate_per_unit');
    }
    assertNonNegativeNumber(totalPayment, 'total_payment');
    assertNonNegativeNumber(paidAmount, 'paid_amount');
    assertOptionalString(description, 'description');
    assertOptionalString(vehicleNumber, 'vehicle_number');
    assertOptionalString(dueDate, 'due_date');
    try {
      return vlRepo.updateVendorLedgerEntry(id, vendorId, transactionDatetime, items, totalPayment, paidAmount, description, vehicleNumber, dueDate);
    } catch (err: any) {
      console.log(err.message);
      if (err.code === 'SQLITE_CONSTRAINT_CHECK' && err.message.includes('quantity >= 0')) {
        throw new Error('Cannot update to this quantity. These items have already been sold or removed from inventory, so this change would result in negative stock.');
      }
      throw err;
    }
  });

  ipcMain.handle('vendor-ledger:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    try {
      vlRepo.softDeleteVendorLedgerEntry(id);
      return { success: true };
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT_CHECK' && err.message.includes('quantity >= 0')) {
        throw new Error('Cannot delete this purchase entry. These items have already been sold or removed from inventory, so deleting this would result in negative stock.');
      }
      throw err;
    }
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

  ipcMain.handle('vendor-ledger:create-with-new-vendor', (_e, vendorData: any, purchaseData: any) => {
    try {
      // Validate vendor fields (mirrors vendors:create exactly)
      assertName(vendorData?.name, 'name');
      assertPhone(vendorData?.phone, 'phone');
      assertAddress(vendorData?.address, 'address');
      assertOptionalString(vendorData?.mill_name, 'mill_name');
      if (vendorData?.opening_balance !== undefined) assertNumber(vendorData.opening_balance, 'opening_balance');
      
      // Validate purchase fields
      assertValidDateString(purchaseData?.transactionDatetime, 'transaction_datetime');
      if (!Array.isArray(purchaseData?.items) || purchaseData.items.length === 0) throw new Error('At least one item is required');
      for (const item of purchaseData.items) {
        assertNonEmptyString(item?.productId, 'product_id');
        assertPositiveNumber(item?.quantity, 'quantity');
        assertPositiveNumber(item?.ratePerUnit, 'rate_per_unit');
      }
      assertNonNegativeNumber(purchaseData?.totalPayment, 'total_payment');
      assertNonNegativeNumber(purchaseData?.paidAmount, 'paid_amount');
      assertOptionalString(purchaseData?.description, 'description');
      assertOptionalString(purchaseData?.vehicleNumber, 'vehicle_number');
      assertOptionalString(purchaseData?.dueDate, 'due_date');

      return vlRepo.createVendorWithPurchase(
        {
          name: vendorData.name.trim(),
          phone: vendorData.phone.trim(),
          address: vendorData.address.trim(),
          mill_name: vendorData.mill_name?.trim() || undefined,
          opening_balance: vendorData.opening_balance ?? 0,
        },
        {
          items: purchaseData.items.map((it: any) => ({
            productId: it.productId,
            quantity: it.quantity,
            ratePerUnit: it.ratePerUnit
          })),
          transactionDatetime: purchaseData.transactionDatetime,
          totalPayment: purchaseData.totalPayment,
          paidAmount: purchaseData.paidAmount,
          description: purchaseData.description || undefined,
          vehicleNumber: purchaseData.vehicleNumber || undefined,
          dueDate: purchaseData.dueDate || undefined,
        }
      );
    } catch (err) {
      return handleIpcError(err);
    }
  });
  ipcMain.handle('vendor-ledger:export-excel', async (_e, vendorId: string, fromDate?: string, toDate?: string) => {
    try {
      assertNonEmptyString(vendorId, 'vendor_id');
      if (fromDate) assertValidDateString(fromDate, 'from_date');
      if (toDate) assertValidDateString(toDate, 'to_date');

      let exportDir = dayClosingRepo.getExportDir();
      if (!exportDir) {
        const win = BrowserWindow.fromWebContents(_e.sender) || BrowserWindow.getAllWindows()[0];
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
          title: 'Choose Directory for Vendor Ledger Export',
          properties: ['openDirectory', 'createDirectory'],
        });
        if (canceled || filePaths.length === 0) return { success: false, canceled: true };
        exportDir = filePaths[0];
        dayClosingRepo.setExportDir(exportDir);
      }

      const { buffer, filePath } = await vlRepo.exportVendorLedgerExcel(vendorId, fromDate, toDate, exportDir);
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (err) {
      return handleIpcError(err);
    }
  });
}
