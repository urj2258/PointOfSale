import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface VendorRow {
  id: string
  name: string
  phone: string | null
  address: string | null
  mill_name: string | null
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

export function createVendor(name: string, phone?: string, address?: string, mill_name?: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO vendors (id, name, phone, address, mill_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, phone ?? null, address ?? null, mill_name ?? null, now, now);
  return getVendorById(id);
}

export function updateVendor(id: string, name: string, phone?: string, address?: string, mill_name?: string) {
  const db = getDatabase();
  updateRow(db, 'vendors', id, { name, phone: phone ?? null, address: address ?? null, mill_name: mill_name ?? null });
  return getVendorById(id);
}

export function softDeleteVendor(id: string) {
  const db = getDatabase();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    const ledgerEntries = db.prepare(
      'SELECT id, quantity, product_id FROM vendor_ledger WHERE vendor_id = ? AND deleted_at IS NULL'
    ).all(id) as { id: string; quantity: number; product_id: string }[];

    for (const entry of ledgerEntries) {
      softDeleteRow(db, 'vendor_ledger', entry.id);
      db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?')
        .run(entry.quantity, now, entry.product_id);
    }

    const invoices = db.prepare(
      'SELECT id FROM vendor_invoices WHERE vendor_id = ? AND deleted_at IS NULL'
    ).all(id) as { id: string }[];

    for (const invoice of invoices) {
      db.prepare('UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_invoice_id = ? AND deleted_at IS NULL')
        .run(now, now, invoice.id);
      softDeleteRow(db, 'vendor_invoices', invoice.id);
    }

    softDeleteRow(db, 'vendors', id);
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
