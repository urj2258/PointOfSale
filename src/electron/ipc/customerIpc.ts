import { ipcMain } from 'electron';
import * as customerRepo from '../repositories/customerRepository.js';
import { assertNonEmptyString, assertName, assertPhone, assertAddress, assertOptionalString, handleIpcError } from '../validation.js';

export function registerCustomerIpc() {
  ipcMain.handle('customers:list', (_e, search?: string, page?: number, limit?: number) => {
    assertOptionalString(search, 'search');
    return customerRepo.getAllCustomers(search, page, limit);
  });

  ipcMain.handle('customers:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return customerRepo.getCustomerById(id);
  });

  ipcMain.handle('customers:create', (_e, name: string, phone?: string, address?: string, shop_name?: string) => {
    try {
      assertName(name, 'name');
      assertPhone(phone, 'phone');
      assertAddress(address, 'address');
      assertOptionalString(shop_name, 'shop_name');
      return customerRepo.createCustomer(name.trim(), phone.trim(), address.trim(), shop_name?.trim());
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('customers:update', (_e, id: string, name: string, phone?: string, address?: string, shop_name?: string) => {
    try {
      assertNonEmptyString(id, 'id');
      assertName(name, 'name');
      assertPhone(phone, 'phone');
      assertAddress(address, 'address');
      assertOptionalString(shop_name, 'shop_name');
      return customerRepo.updateCustomer(id, name.trim(), phone.trim(), address.trim(), shop_name?.trim());
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('customers:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    customerRepo.softDeleteCustomer(id);
    return { success: true };
  });

  ipcMain.handle('customers:outstanding', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return customerRepo.getCustomerOutstanding(id);
  });
}
