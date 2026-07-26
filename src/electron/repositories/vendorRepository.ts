import Database from 'better-sqlite3';
import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface VendorRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  mill_name: string | null
  opening_balance: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export function getAllVendors(search?: string, page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE deleted_at IS NULL';
  const params: unknown[] = [];

  if (search) {
    where += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM vendors ${where}`).get(...params) as { total: number };
  const data = db.prepare(`SELECT * FROM vendors ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset) as VendorRow[];

  return { data, total: countRow.total, page, limit };
}

export function getVendorById(id: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM vendors WHERE id = ? AND deleted_at IS NULL').get(id) as VendorRow | undefined;
}

export function createVendor(name: string, phone?: string, address?: string, mill_name?: string, opening_balance = 0) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO vendors (id, name, phone, address, mill_name, opening_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone ?? null, address ?? null, mill_name ?? null, opening_balance, now, now);
  return getVendorById(id);
}

/**
 * Low-level insert usable inside an external db.transaction().
 * Does NOT open its own transaction — caller is responsible.
 */
export function insertVendorInTx(
  db: Database.Database,
  id: string,
  now: string,
  name: string,
  phone: string,
  address: string,
  mill_name?: string,
  opening_balance = 0
): void {
  db.prepare(`
    INSERT INTO vendors (id, name, phone, address, mill_name, opening_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone, address, mill_name ?? null, opening_balance, now, now);
}

export function updateVendor(id: string, name: string, phone?: string, address?: string, mill_name?: string, opening_balance?: number) {
  const db = getDatabase();
  const updates: Record<string, any> = { name, phone: phone ?? null, address: address ?? null, mill_name: mill_name ?? null };
  if (opening_balance !== undefined) updates.opening_balance = opening_balance;
  updateRow(db, 'vendors', id, updates);
  return getVendorById(id);
}

export function softDeleteVendor(id: string) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const getInvoiceItems = db.prepare(
    'SELECT product_id, quantity FROM vendor_invoice_items WHERE vendor_invoice_id = ? AND deleted_at IS NULL'
  );
  const deductInventory = db.prepare(
    'UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?'
  );
  const getInvoices = db.prepare(
    'SELECT id FROM vendor_invoices WHERE vendor_id = ? AND deleted_at IS NULL'
  );
  const softDeleteInvoiceItems = db.prepare(
    'UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_invoice_id = ? AND deleted_at IS NULL'
  );
  const softDeleteLedger = db.prepare(
    'UPDATE vendor_ledger SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_id = ?'
  );
  const softDeleteVendorRow = db.prepare(
    'UPDATE vendors SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?'
  );
  const softDeleteInvoices = db.prepare(
    'UPDATE vendor_invoices SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?'
  );

  const transaction = db.transaction(() => {
    softDeleteLedger.run(now, now, id);

    const invoices = getInvoices.all(id) as { id: string }[];

    for (const invoice of invoices) {
      const items = getInvoiceItems.all(invoice.id) as { product_id: string; quantity: number }[];
      for (const item of items) {
        deductInventory.run(item.quantity, now, item.product_id);
      }
      softDeleteInvoiceItems.run(now, now, invoice.id);
      softDeleteInvoices.run(now, now, invoice.id);
    }

    softDeleteVendorRow.run(now, now, id);
  });

  transaction();
}

export function getVendorOutstanding(id: string) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM vendor_ledger WHERE vendor_id = ? AND deleted_at IS NULL
  `).get(id) as { total: number };
  return row.total;
}

export function getVendorRunningBalance(id: string): number {
  const db = getDatabase();
  const vendor = db.prepare('SELECT opening_balance FROM vendors WHERE id = ? AND deleted_at IS NULL').get(id) as { opening_balance: number } | undefined;
  if (!vendor) throw new Error('Vendor not found');
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total_purchases,
           COALESCE(SUM(paid_amount), 0) as total_paid
    FROM vendor_ledger WHERE vendor_id = ? AND deleted_at IS NULL
  `).get(id) as { total_purchases: number; total_paid: number };
  return vendor.opening_balance - row.total_purchases + row.total_paid;
}
