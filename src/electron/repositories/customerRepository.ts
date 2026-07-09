import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  shop_name: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export function getAllCustomers(search?: string, page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE deleted_at IS NULL';
  const params: unknown[] = [];

  if (search) {
    where += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM customers ${where}`).get(...params) as { total: number };
  const data = db.prepare(`SELECT * FROM customers ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset) as CustomerRow[];

  return { data, total: countRow.total, page, limit };
}

export function getCustomerById(id: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL').get(id) as CustomerRow | undefined;
}

export function createCustomer(name: string, phone?: string, address?: string, shop_name?: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO customers (id, name, phone, address, shop_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone ?? null, address ?? null, shop_name ?? null, now, now);
  return getCustomerById(id);
}

export function updateCustomer(id: string, name: string, phone?: string, address?: string, shop_name?: string) {
  const db = getDatabase();
  updateRow(db, 'customers', id, { name, phone: phone ?? null, address: address ?? null, shop_name: shop_name ?? null });
  return getCustomerById(id);
}

export function softDeleteCustomer(id: string) {
  const db = getDatabase();
  softDeleteRow(db, 'customers', id);
}

export function getCustomerOutstanding(id: string) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM customer_ledger WHERE customer_id = ? AND deleted_at IS NULL
  `).get(id) as { total: number };
  return row.total;
}
