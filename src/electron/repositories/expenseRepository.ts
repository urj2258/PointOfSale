import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface ExpenseCategoryRow {
  id: string
  name: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface ExpenseRow {
  id: string
  category_id: string
  transaction_datetime: string
  amount: number
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export function getAllExpenseCategories() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM expense_categories WHERE deleted_at IS NULL ORDER BY name').all() as ExpenseCategoryRow[];
}

export function createExpenseCategory(name: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO expense_categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name, now, now);
  return db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as ExpenseCategoryRow;
}

export function updateExpenseCategory(id: string, name: string) {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM expense_categories WHERE id = ? AND deleted_at IS NULL').get(id);
  if (!existing) throw new Error('Expense category not found');
  updateRow(db, 'expense_categories', id, { name });
  return db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id) as ExpenseCategoryRow;
}

export function deleteExpenseCategory(id: string) {
  const db = getDatabase();
  softDeleteRow(db, 'expense_categories', id);
}

export function getExpenses(categoryId?: string, month?: string, page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE e.deleted_at IS NULL';
  const params: unknown[] = [];

  if (categoryId) {
    where += ' AND e.category_id = ?';
    params.push(categoryId);
  }
  if (month) {
    where += ' AND e.transaction_datetime LIKE ?';
    params.push(`${month}%`);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM expenses e ${where}`).get(...params) as { total: number };
  const data = db.prepare(`
    SELECT e.*, ec.name as category_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    ${where}
    ORDER BY e.transaction_datetime DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (ExpenseRow & { category_name: string })[];

  return { data, total: countRow.total, page, limit };
}

export function createExpense(categoryId: string, transactionDatetime: string, amount: number, description?: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO expenses (id, category_id, transaction_datetime, amount, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, categoryId, transactionDatetime, amount, description ?? null, now, now);

  return getExpenseById(id);
}

export function getExpenseById(id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT e.*, ec.name as category_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.id = ? AND e.deleted_at IS NULL
  `).get(id) as (ExpenseRow & { category_name: string }) | undefined;
}

export function updateExpense(id: string, categoryId: string, transactionDatetime: string, amount: number, description?: string) {
  const db = getDatabase();
  updateRow(db, 'expenses', id, { category_id: categoryId, transaction_datetime: transactionDatetime, amount, description: description ?? null });
  return getExpenseById(id);
}

export function deleteExpense(id: string) {
  const db = getDatabase();
  softDeleteRow(db, 'expenses', id);
}

export function getTodayExpenseTotal() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${today}%`) as { total: number };
  return row.total;
}

export function getMonthlyExpenses() {
  const db = getDatabase();
  return db.prepare(`
    SELECT SUBSTR(transaction_datetime, 1, 7) as month,
           ec.name as category_name,
           SUM(amount) as total
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.deleted_at IS NULL
    GROUP BY month, ec.name
    ORDER BY month DESC
  `).all() as { month: string; category_name: string; total: number }[];
}
