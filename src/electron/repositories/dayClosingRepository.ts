import { getDatabase } from '../database.js';
import crypto from 'crypto';

export interface DayClosingRow {
  id: string
  business_date: string
  total_sales: number
  total_purchases: number
  total_expenses: number
  created_at: string
}

export function getDayClosings(page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;
  const countRow = db.prepare('SELECT COUNT(*) as total FROM day_closing_reports').get() as { total: number };
  const data = db.prepare('SELECT * FROM day_closing_reports ORDER BY business_date DESC LIMIT ? OFFSET ?').all(limit, offset) as DayClosingRow[];
  return { data, total: countRow.total, page, limit };
}

export function getDayClosingByDate(date: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM day_closing_reports WHERE business_date = ?').get(date) as DayClosingRow | undefined;
}

export function generateDayClosing(businessDate: string) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const salesRow = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM customer_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${businessDate}%`) as { total: number };

  const purchasesRow = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM vendor_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${businessDate}%`) as { total: number };

  const expensesRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${businessDate}%`) as { total: number };

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO day_closing_reports (id, business_date, total_sales, total_purchases, total_expenses, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, businessDate, salesRow.total, purchasesRow.total, expensesRow.total, now);

  return getDayClosingByDate(businessDate);
}
