import { ipcMain } from 'electron';
import * as customerRepo from '../repositories/customerRepository.js';
import { assertNonEmptyString, assertOptionalString } from '../validation.js';

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
    assertNonEmptyString(name, 'name');
    assertOptionalString(phone, 'phone');
    assertOptionalString(address, 'address');
    assertOptionalString(shop_name, 'shop_name');
    return customerRepo.createCustomer(name, phone, address, shop_name);
  });

  ipcMain.handle('customers:update', (_e, id: string, name: string, phone?: string, address?: string, shop_name?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(name, 'name');
    assertOptionalString(phone, 'phone');
    assertOptionalString(address, 'address');
    assertOptionalString(shop_name, 'shop_name');
    return customerRepo.updateCustomer(id, name, phone, address, shop_name);
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
