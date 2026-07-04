import { getDatabase } from '../database.js';
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
  const now = new Date().toISOString();

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
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE vendors SET name = ?, phone = ?, address = ?, mill_name = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(name, phone ?? null, address ?? null, mill_name ?? null, now, id);
  return getVendorById(id);
}

export function softDeleteVendor(id: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE vendors SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
}

export function getVendorOutstanding(id: string) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM vendor_ledger WHERE vendor_id = ? AND deleted_at IS NULL
  `).get(id) as { total: number };
  return row.total;
}
