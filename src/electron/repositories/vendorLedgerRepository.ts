import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface VendorLedgerRow {
  id: string
  vendor_id: string
  product_id: string
  transaction_datetime: string
  description: string | null
  vehicle_number: string | null
  quantity: number
  rate_per_unit: number
  total_payment: number
  paid_amount: number
  remaining_balance: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export function getVendorLedgerEntries(vendorId?: string, dateFrom?: string, dateTo?: string, page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE vl.deleted_at IS NULL';
  const params: unknown[] = [];

  if (vendorId) {
    where += ' AND vl.vendor_id = ?';
    params.push(vendorId);
  }
  if (dateFrom) {
    where += ' AND vl.transaction_datetime >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND vl.transaction_datetime <= ?';
    params.push(dateTo);
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM vendor_ledger vl ${where}
  `).get(...params) as { total: number };

  const data = db.prepare(`
    SELECT vl.*, v.name as vendor_name, i.name as product_name
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    LEFT JOIN inventory i ON i.id = vl.product_id
    ${where}
    ORDER BY vl.transaction_datetime DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (VendorLedgerRow & { vendor_name: string; product_name: string })[];

  return { data, total: countRow.total, page, limit };
}

export function getVendorLedgerById(id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT vl.*, v.name as vendor_name, i.name as product_name
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    LEFT JOIN inventory i ON i.id = vl.product_id
    WHERE vl.id = ? AND vl.deleted_at IS NULL
  `).get(id) as (VendorLedgerRow & { vendor_name: string; product_name: string }) | undefined;
}

export function createVendorLedgerEntry(
  vendorId: string, productId: string, transactionDatetime: string,
  quantity: number, ratePerUnit: number, totalPayment: number,
  paidAmount: number, description?: string, vehicleNumber?: string
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const remainingBalance = totalPayment - paidAmount;

  const insertLedger = db.prepare(`
    INSERT INTO vendor_ledger (id, vendor_id, product_id, transaction_datetime, description, vehicle_number,
      quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare(`
    UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    insertLedger.run(id, vendorId, productId, transactionDatetime, description ?? null, vehicleNumber ?? null,
      quantity, ratePerUnit, totalPayment, paidAmount, remainingBalance, now, now);
    updateStock.run(quantity, now, productId);
  });

  transaction();
  return getVendorLedgerById(id);
}

export function updateVendorLedgerEntry(
  id: string, vendorId: string, productId: string, transactionDatetime: string,
  quantity: number, ratePerUnit: number, totalPayment: number,
  paidAmount: number, description?: string, vehicleNumber?: string
) {
  const db = getDatabase();
  const existing = getVendorLedgerById(id);
  if (!existing) throw new Error('Vendor ledger entry not found');

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    const remainingBalance = totalPayment - paidAmount;

    updateRow(db, 'vendor_ledger', id, {
      vendor_id: vendorId,
      product_id: productId,
      transaction_datetime: transactionDatetime,
      quantity,
      rate_per_unit: ratePerUnit,
      total_payment: totalPayment,
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      description: description ?? null,
      vehicle_number: vehicleNumber ?? null,
    });

    const oldQty = existing.quantity;
    const oldProductId = existing.product_id;
    const qtyDiff = quantity - oldQty;

    if (oldProductId !== productId) {
      db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?').run(oldQty, now, oldProductId);
      db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?').run(quantity, now, productId);
    } else if (qtyDiff !== 0) {
      db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?').run(qtyDiff, now, productId);
    }
  });

  transaction();
  return getVendorLedgerById(id);
}

export function softDeleteVendorLedgerEntry(id: string) {
  const db = getDatabase();
  const entry = getVendorLedgerById(id);
  if (!entry) throw new Error('Vendor ledger entry not found');

  const transaction = db.transaction(() => {
    softDeleteRow(db, 'vendor_ledger', id);
    const now = new Date().toISOString();
    db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?').run(entry.quantity, now, entry.product_id);
  });

  transaction();
}

export function getTodayVendorTotal() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM vendor_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${today}%`) as { total: number };
  return row.total;
}
