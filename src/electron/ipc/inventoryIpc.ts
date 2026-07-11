import { ipcMain } from 'electron';
import * as inventoryRepo from '../repositories/inventoryRepository.js';
import {
  assertNonEmptyString, assertOptionalString, assertPositiveNumber,
  assertProductName, assertAllowedUnit, assertNonNegativeInteger, assertDescription,
  handleIpcError,
} from '../validation.js';

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
    try {
      assertProductName(name, 'name');
      assertAllowedUnit(unit, 'unit');
      assertNonNegativeInteger(quantity, 'quantity');
      if (description !== undefined && description !== null && description.trim() !== '') {
        assertDescription(description, 'description');
      }
      return inventoryRepo.createInventoryItem(name.trim(), unit.trim().toLowerCase(), quantity, description?.trim());
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('inventory:update', (_e, id: string, name: string, unit: string, description?: string) => {
    try {
      assertNonEmptyString(id, 'id');
      assertProductName(name, 'name');
      assertAllowedUnit(unit, 'unit');
      if (description !== undefined && description !== null && description.trim() !== '') {
        assertDescription(description, 'description');
      }
      return inventoryRepo.updateInventoryItem(id, name.trim(), unit.trim().toLowerCase(), description?.trim());
    } catch (err) {
      return handleIpcError(err);
    }
  });

  ipcMain.handle('inventory:adjust-stock', (_e, id: string, quantityChange: number) => {
    try {
      assertNonEmptyString(id, 'id');
      assertNonNegativeInteger(quantityChange, 'quantity_change');
      return inventoryRepo.adjustStock(id, quantityChange);
    } catch (err) {
      return handleIpcError(err);
    }
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
