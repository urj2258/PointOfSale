import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  shop_name: string | null
  opening_balance: number
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

export function createCustomer(name: string, phone?: string, address?: string, shop_name?: string, opening_balance = 0) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO customers (id, name, phone, address, shop_name, opening_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone ?? null, address ?? null, shop_name ?? null, opening_balance, now, now);
  return getCustomerById(id);
}

import Database from 'better-sqlite3';

/**
 * Low-level insert usable inside an external db.transaction().
 * Does NOT open its own transaction — caller is responsible.
 */
export function insertCustomerInTx(
  db: Database.Database,
  id: string,
  now: string,
  name: string,
  phone: string,
  address: string,
  shop_name?: string,
  opening_balance = 0
): void {
  db.prepare(`
    INSERT INTO customers (id, name, phone, address, shop_name, opening_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone, address, shop_name ?? null, opening_balance, now, now);
}


export function updateCustomer(id: string, name: string, phone?: string, address?: string, shop_name?: string, opening_balance?: number) {
  const db = getDatabase();
  const updates: Record<string, any> = { name, phone: phone ?? null, address: address ?? null, shop_name: shop_name ?? null };
  if (opening_balance !== undefined) updates.opening_balance = opening_balance;
  updateRow(db, 'customers', id, updates);
  return getCustomerById(id);
}

export function softDeleteCustomer(id: string) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const getLedgerEntries = db.prepare(
    'SELECT id, invoice_id FROM customer_ledger WHERE customer_id = ? AND deleted_at IS NULL'
  );
  const getInvoiceItems = db.prepare(
    'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ? AND deleted_at IS NULL'
  );
  const addInventory = db.prepare(
    'UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?'
  );
  const softDeleteInvoiceItems = db.prepare(
    'UPDATE invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE invoice_id = ? AND deleted_at IS NULL'
  );
  const softDeleteInvoices = db.prepare(
    'UPDATE invoices SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ? AND deleted_at IS NULL'
  );
  const softDeleteLedger = db.prepare(
    'UPDATE customer_ledger SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?'
  );
  const softDeleteCustomerRow = db.prepare(
    'UPDATE customers SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?'
  );

  const transaction = db.transaction(() => {
    const ledgerEntries = getLedgerEntries.all(id) as { id: string; invoice_id: string | null }[];

    for (const entry of ledgerEntries) {
      if (entry.invoice_id) {
        const items = getInvoiceItems.all(entry.invoice_id) as { product_id: string; quantity: number }[];
        for (const item of items) {
          addInventory.run(item.quantity, now, item.product_id);
        }
        softDeleteInvoiceItems.run(now, now, entry.invoice_id);
        softDeleteInvoices.run(now, now, entry.invoice_id);
      }
      softDeleteLedger.run(now, now, entry.id);
    }

    softDeleteCustomerRow.run(now, now, id);
  });

  transaction();
}

// Note: Superseded by getCustomerRunningBalance (which includes opening_balance).
// Kept for backward compatibility via preload/api bridge.
export function getCustomerOutstanding(id: string) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM customer_ledger WHERE customer_id = ? AND deleted_at IS NULL
  `).get(id) as { total: number };
  return row.total;
}

export function getCustomerRunningBalance(id: string): number {
  const db = getDatabase();
  const customer = db.prepare('SELECT opening_balance FROM customers WHERE id = ? AND deleted_at IS NULL').get(id) as { opening_balance: number } | undefined;
  if (!customer) throw new Error('Customer not found');
  // running balance = opening_balance + SUM(total_payment) - SUM(paid_amount)
  // Sale increases what customer owes (+total_payment), payment reduces it (-paid_amount)
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total_sales,
           COALESCE(SUM(paid_amount), 0) as total_paid
    FROM customer_ledger WHERE customer_id = ? AND deleted_at IS NULL
  `).get(id) as { total_sales: number; total_paid: number };
  return customer.opening_balance + row.total_sales - row.total_paid;
}
