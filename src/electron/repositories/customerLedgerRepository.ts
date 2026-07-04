import { getDatabase } from '../database.js';
import crypto from 'crypto';

export interface CustomerLedgerRow {
  id: string
  customer_id: string
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

export function getCustomerLedgerEntries(customerId?: string, dateFrom?: string, dateTo?: string, page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE cl.deleted_at IS NULL';
  const params: unknown[] = [];

  if (customerId) {
    where += ' AND cl.customer_id = ?';
    params.push(customerId);
  }
  if (dateFrom) {
    where += ' AND cl.transaction_datetime >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND cl.transaction_datetime <= ?';
    params.push(dateTo);
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM customer_ledger cl ${where}
  `).get(...params) as { total: number };

  const data = db.prepare(`
    SELECT cl.*, c.name as customer_name, i.name as product_name
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN inventory i ON i.id = cl.product_id
    ${where}
    ORDER BY cl.transaction_datetime DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (CustomerLedgerRow & { customer_name: string; product_name: string })[];

  return { data, total: countRow.total, page, limit };
}

export function getCustomerLedgerById(id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT cl.*, c.name as customer_name, i.name as product_name
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN inventory i ON i.id = cl.product_id
    WHERE cl.id = ? AND cl.deleted_at IS NULL
  `).get(id) as (CustomerLedgerRow & { customer_name: string; product_name: string }) | undefined;
}

export function createCustomerLedgerEntry(
  customerId: string, productId: string, transactionDatetime: string,
  quantity: number, ratePerUnit: number, totalPayment: number,
  paidAmount: number, description?: string, vehicleNumber?: string
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const remainingBalance = totalPayment - paidAmount;

  const insertLedger = db.prepare(`
    INSERT INTO customer_ledger (id, customer_id, product_id, transaction_datetime, description, vehicle_number,
      quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare(`
    UPDATE inventory SET quantity = quantity - ?, updated_at = ? WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    insertLedger.run(id, customerId, productId, transactionDatetime, description ?? null, vehicleNumber ?? null,
      quantity, ratePerUnit, totalPayment, paidAmount, remainingBalance, now, now);
    const result = updateStock.run(quantity, now, productId);
    if (result.changes === 0) throw new Error('Product not found in inventory');
  });

  transaction();
  return getCustomerLedgerById(id);
}

export function updateCustomerLedgerEntry(
  id: string, paidAmount: number, description?: string, vehicleNumber?: string
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = getCustomerLedgerById(id);
  if (!existing) throw new Error('Customer ledger entry not found');

  db.prepare(`
    UPDATE customer_ledger SET paid_amount = ?, remaining_balance = total_payment - ?,
      description = ?, vehicle_number = ?, updated_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(paidAmount, paidAmount, description ?? null, vehicleNumber ?? null, now, id);

  return getCustomerLedgerById(id);
}

export function softDeleteCustomerLedgerEntry(id: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const entry = getCustomerLedgerById(id);
  if (!entry) throw new Error('Customer ledger entry not found');

  const transaction = db.transaction(() => {
    db.prepare('UPDATE customer_ledger SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
    db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(entry.quantity, entry.product_id);
  });

  transaction();
}

export function getTodayCustomerTotal() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM customer_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${today}%`) as { total: number };
  return row.total;
}
