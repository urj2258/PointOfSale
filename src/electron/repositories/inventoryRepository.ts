import { getDatabase } from '../database.js';
import crypto from 'crypto';

export interface InventoryRow {
  id: string
  name: string
  unit: string
  quantity: number
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export function getAllInventory(search?: string, page = 1, limit = 20, lowStock = false, lowStockThreshold = 10) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE deleted_at IS NULL';
  const params: unknown[] = [];

  if (search) {
    where += ' AND (name LIKE ?)';
    params.push(`%${search}%`);
  }

  if (lowStock) {
    where += ' AND quantity <= ?';
    params.push(lowStockThreshold);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM inventory ${where}`).get(...params) as { total: number };
  const data = db.prepare(`SELECT * FROM inventory ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset) as InventoryRow[];

  return { data, total: countRow.total, page, limit };
}

export function getInventoryById(id: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM inventory WHERE id = ? AND deleted_at IS NULL').get(id) as InventoryRow | undefined;
}

export function createInventoryItem(name: string, unit: string, quantity: number, description?: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO inventory (id, name, unit, quantity, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, unit, quantity, description ?? null, now, now);
  return getInventoryById(id);
}

export function updateInventoryItem(id: string, name: string, unit: string, description?: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE inventory SET name = ?, unit = ?, description = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(name, unit, description ?? null, now, id);
  return getInventoryById(id);
}

export function adjustStock(id: string, quantityChange: number) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const item = getInventoryById(id);
  if (!item) throw new Error('Inventory item not found');
  const newQty = item.quantity + quantityChange;
  if (newQty < 0) throw new Error('Insufficient stock');
  db.prepare('UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?').run(newQty, now, id);
  return getInventoryById(id);
}

export function softDeleteInventoryItem(id: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare('UPDATE inventory SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
}

export function getLowStockCount(threshold = 10) {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE deleted_at IS NULL AND quantity <= ?').get(threshold) as { count: number };
  return row.count;
}
