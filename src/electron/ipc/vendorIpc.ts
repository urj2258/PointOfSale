import { ipcMain } from 'electron';
import * as vendorRepo from '../repositories/vendorRepository.js';
import { assertNonEmptyString, assertPhone, assertOptionalString } from '../validation.js';

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
    assertNonEmptyString(name, 'name');
    assertOptionalString(phone, 'phone');
    assertOptionalString(address, 'address');
    assertOptionalString(mill_name, 'mill_name');
    return vendorRepo.createVendor(name, phone, address, mill_name);
  });

  ipcMain.handle('vendors:update', (_e, id: string, name: string, phone?: string, address?: string, mill_name?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(name, 'name');
    assertOptionalString(phone, 'phone');
    assertOptionalString(address, 'address');
    assertOptionalString(mill_name, 'mill_name');
    return vendorRepo.updateVendor(id, name, phone, address, mill_name);
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
