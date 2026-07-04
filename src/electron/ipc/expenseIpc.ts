import { ipcMain } from 'electron';
import * as expenseRepo from '../repositories/expenseRepository.js';
import { assertNonEmptyString, assertOptionalString, assertPositiveNumber, assertValidDateString } from '../validation.js';

export function registerExpenseIpc() {
  ipcMain.handle('expense-categories:list', () => {
    return expenseRepo.getAllExpenseCategories();
  });

  ipcMain.handle('expense-categories:create', (_e, name: string) => {
    assertNonEmptyString(name, 'name');
    return expenseRepo.createExpenseCategory(name);
  });

  ipcMain.handle('expense-categories:update', (_e, id: string, name: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(name, 'name');
    return expenseRepo.updateExpenseCategory(id, name);
  });

  ipcMain.handle('expense-categories:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    expenseRepo.deleteExpenseCategory(id);
    return { success: true };
  });

  ipcMain.handle('expenses:list', (_e, categoryId?: string, month?: string, page?: number, limit?: number) => {
    assertOptionalString(categoryId, 'category_id');
    assertOptionalString(month, 'month');
    return expenseRepo.getExpenses(categoryId, month, page, limit);
  });

  ipcMain.handle('expenses:create', (_e, categoryId: string, transactionDatetime: string, amount: number, description?: string) => {
    assertNonEmptyString(categoryId, 'category_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    assertPositiveNumber(amount, 'amount');
    assertOptionalString(description, 'description');
    return expenseRepo.createExpense(categoryId, transactionDatetime, amount, description);
  });

  ipcMain.handle('expenses:update', (_e, id: string, categoryId: string, transactionDatetime: string, amount: number, description?: string) => {
    assertNonEmptyString(id, 'id');
    assertNonEmptyString(categoryId, 'category_id');
    assertValidDateString(transactionDatetime, 'transaction_datetime');
    assertPositiveNumber(amount, 'amount');
    assertOptionalString(description, 'description');
    return expenseRepo.updateExpense(id, categoryId, transactionDatetime, amount, description);
  });

  ipcMain.handle('expenses:delete', (_e, id: string) => {
    assertNonEmptyString(id, 'id');
    expenseRepo.deleteExpense(id);
    return { success: true };
  });

  ipcMain.handle('expenses:monthly', () => {
    return expenseRepo.getMonthlyExpenses();
  });
}
