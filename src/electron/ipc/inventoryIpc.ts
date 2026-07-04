import { ipcMain } from 'electron';
import * as inventoryRepo from '../repositories/inventoryRepository.js';
import { assertNonEmptyString, assertOptionalString, assertNonNegativeNumber, assertNumber, assertPositiveNumber } from '../validation.js';

export function registerInventoryIpc() {
  ipcMain.handle('inventory:list', (_e, search?: string, page?: number, limit?: number) => {
    assertOptionalString(search, 'search');
    return inventoryRepo.getAllInventory(search, page, limit);
  });

  ipcMain.handle('inventory:get', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    return inventoryRepo.getInventoryById(id);
  });

  ipcMain.handle('inventory:create', (_e, name: string, unit: string, quantity: number, description?: string) => {
    assertNonEmptyString(name, 'name');
    assertNonEmptyString(unit, 'unit');
    assertNonNegativeNumber(quantity, 'quantity');
    assertOptionalString(description, 'description');
    return inventoryRepo.createInventoryItem(name, unit, quantity, description);
  });

  ipcMain.handle('inventory:update', (_e, id: string, name: string, unit: string, description?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(name, 'name');
    assertNonEmptyString(unit, 'unit');
    assertOptionalString(description, 'description');
    return inventoryRepo.updateInventoryItem(id, name, unit, description);
  });

  ipcMain.handle('inventory:adjust-stock', (_e, id: string, quantityChange: number) => {
    assertNonEmptyString(id, 'id');
    assertNumber(quantityChange, 'quantity_change');
    return inventoryRepo.adjustStock(id, quantityChange);
  });

  ipcMain.handle('inventory:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    inventoryRepo.softDeleteInventoryItem(id);
    return { success: true };
  });

  ipcMain.handle('inventory:low-stock-count', (_e, threshold?: number) => {
    if (threshold !== undefined) assertPositiveNumber(threshold, 'threshold');
    return inventoryRepo.getLowStockCount(threshold);
  });
}
