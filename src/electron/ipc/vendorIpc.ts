import { ipcMain } from 'electron';
import * as vendorRepo from '../repositories/vendorRepository.js';
import { assertNonEmptyString, assertName, assertPhone, assertAddress, assertOptionalString, handleIpcError } from '../validation.js';

export function registerVendorIpc() {
  ipcMain.handle('vendors:list', (_e, search?: string, page?: number, limit?: number) => {
    assertOptionalString(search, 'search');
    return vendorRepo.getAllVendors(search, page, limit);
  });

  ipcMain.handle('vendors:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return vendorRepo.getVendorById(id);
  });

  ipcMain.handle('vendors:create', (_e, name: string, phone?: string, address?: string, mill_name?: string) => {
    try {
      assertName(name, 'name');
      assertPhone(phone, 'phone');
      assertAddress(address, 'address');
      assertOptionalString(mill_name, 'mill_name');
      return vendorRepo.createVendor(name.trim(), phone.trim(), address.trim(), mill_name?.trim());
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('vendors:update', (_e, id: string, name: string, phone?: string, address?: string, mill_name?: string) => {
    try {
      assertNonEmptyString(id, 'id');
      assertName(name, 'name');
      assertPhone(phone, 'phone');
      assertAddress(address, 'address');
      assertOptionalString(mill_name, 'mill_name');
      return vendorRepo.updateVendor(id, name.trim(), phone.trim(), address.trim(), mill_name?.trim());
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('vendors:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    vendorRepo.softDeleteVendor(id);
    return { success: true };
  });

  ipcMain.handle('vendors:outstanding', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return vendorRepo.getVendorOutstanding(id);
  });
}
