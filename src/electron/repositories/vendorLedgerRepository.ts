import Database from 'better-sqlite3';
import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';
import { insertVendorInTx } from './vendorRepository.js';

function itemsAreEqual(
  oldItems: { product_id: string; quantity: number }[],
  newItems: { productId: string; quantity: number; ratePerUnit: number }[]
): boolean {
  if (oldItems.length !== newItems.length) return false;
  const normalize = (arr: { id: string; qty: number }[]) =>
    [...arr].sort((a, b) => a.id.localeCompare(b.id)).map(x => `${x.id}:${x.qty}`);
  const oldNorm = normalize(oldItems.map(i => ({ id: i.product_id, qty: i.quantity })));
  const newNorm = normalize(newItems.map(i => ({ id: i.productId, qty: i.quantity })));
  return oldNorm.join('|') === newNorm.join('|');
}

function syncVendorInvoiceFromLedger(db: Database.Database, invoiceId: string, now: string) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(paid_amount), 0) as totalPaid
    FROM vendor_ledger
    WHERE vendor_invoice_id = ? AND deleted_at IS NULL
  `).get(invoiceId) as { totalPaid: number };

  const invoice = db.prepare('SELECT total FROM vendor_invoices WHERE id = ? AND deleted_at IS NULL').get(invoiceId) as { total: number } | undefined;
  if (!invoice) return;

  const remainingBalance = Math.max(0, invoice.total - row.totalPaid);
  const status = remainingBalance <= 0 ? 'Paid' : 'Pending';

  updateRow(db, 'vendor_invoices', invoiceId, {
    paid_amount: row.totalPaid,
    remaining_balance: remainingBalance,
    status,
  });
}

export interface VendorLedgerRow {
  id: string
  vendor_id: string
  transaction_datetime: string
  description: string | null
  vehicle_number: string | null
  total_payment: number
  paid_amount: number
  remaining_balance: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
  vendor_invoice_id: string | null
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

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM vendor_ledger vl ${where}`).get(...params) as { total: number };

  const data = db.prepare(`
    SELECT vl.*, v.name as vendor_name,
           vi.due_date as invoice_due_date,
           (SELECT json_group_array(json_object('name', i.name, 'quantity', vii.quantity, 'rate', vii.rate_per_unit))
            FROM vendor_invoice_items vii
            JOIN inventory i ON i.id = vii.product_id
            WHERE vii.vendor_invoice_id = vl.vendor_invoice_id AND vii.deleted_at IS NULL) as items_json
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    LEFT JOIN vendor_invoices vi ON vi.id = vl.vendor_invoice_id
    ${where}
    ORDER BY vl.transaction_datetime DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (VendorLedgerRow & { vendor_name: string; items_json: string | null; invoice_due_date: string | null })[];

  const parsed = data.map(row => ({
    ...row,
    items: row.items_json ? JSON.parse(row.items_json) as { name: string; quantity: number; rate: number }[] : [],
  }));

  return { data: parsed, total: countRow.total, page, limit };
}

export function getVendorLedgerById(id: string) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT vl.*, v.name as vendor_name,
           vi.due_date as invoice_due_date,
           (SELECT json_group_array(json_object('name', i.name, 'quantity', vii.quantity, 'rate', vii.rate_per_unit))
            FROM vendor_invoice_items vii
            JOIN inventory i ON i.id = vii.product_id
            WHERE vii.vendor_invoice_id = vl.vendor_invoice_id AND vii.deleted_at IS NULL) as items_json
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    LEFT JOIN vendor_invoices vi ON vi.id = vl.vendor_invoice_id
    WHERE vl.id = ? AND vl.deleted_at IS NULL
  `).get(id) as (VendorLedgerRow & { vendor_name: string; items_json: string | null; invoice_due_date: string | null }) | undefined;

  if (!row) return undefined;

  return {
    ...row,
    items: row.items_json ? JSON.parse(row.items_json) as { name: string; quantity: number; rate: number }[] : [],
  };
}

export function createVendorLedgerEntry(
  vendorId: string, transactionDatetime: string,
  items: { productId: string; quantity: number; ratePerUnit: number }[],
  totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string,
  dueDate?: string
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const ledgerId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();
  const remainingBalance = totalPayment - paidAmount;

  const transaction = db.transaction(() => {
    // 1. Create vendor_invoice
    const invoiceTotal = items.reduce((sum, it) => sum + (it.quantity * it.ratePerUnit), 0);
    const invoiceNumber = `INV-${Date.now()}`;
    const resolvedDueDate = dueDate || transactionDatetime.split('T')[0];
    db.prepare(`
      INSERT INTO vendor_invoices (id, vendor_id, invoice_number, issue_date, due_date, subtotal, total, paid_amount, remaining_balance, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceId, vendorId, invoiceNumber, transactionDatetime.split('T')[0], resolvedDueDate, invoiceTotal, invoiceTotal, paidAmount, invoiceTotal - paidAmount, (invoiceTotal - paidAmount) <= 0 ? 'Paid' : 'Pending', now, now);

    // 2. Insert items and update stock
    for (const item of items) {
      const itemId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, invoiceId, item.productId, item.quantity, item.ratePerUnit, item.quantity * item.ratePerUnit, now, now);

      db.prepare(`UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?`)
        .run(item.quantity, now, item.productId);
    }

    // 3. Create vendor_ledger
    db.prepare(`
      INSERT INTO vendor_ledger (id, vendor_id, transaction_datetime, description, vehicle_number,
        total_payment, paid_amount, remaining_balance, created_at, updated_at, vendor_invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, vendorId, transactionDatetime, description ?? null, vehicleNumber ?? null,
      totalPayment, paidAmount, remainingBalance, now, now, invoiceId);
  });

  transaction();
  return getVendorLedgerById(ledgerId);
}

/**
 * Atomically creates a new vendor row and a vendor_ledger entry in one SQLite transaction.
 * If either insert fails the whole operation rolls back — no orphan vendors.
 */
export function createVendorWithPurchase(
  vendor: { name: string; phone: string; address: string; mill_name?: string },
  purchase: {
    items: { productId: string; quantity: number; ratePerUnit: number }[];
    transactionDatetime: string; totalPayment: number; paidAmount: number;
    description?: string; vehicleNumber?: string; dueDate?: string;
  }
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const vendorId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();
  const remainingBalance = purchase.totalPayment - purchase.paidAmount;

  const transaction = db.transaction(() => {
    // 1. Insert the new vendor
    insertVendorInTx(db, vendorId, now, vendor.name, vendor.phone, vendor.address, vendor.mill_name);

    // 2. Create vendor_invoice
    const invoiceTotal = purchase.items.reduce((sum, it) => sum + (it.quantity * it.ratePerUnit), 0);
    const invoiceNumber = `INV-${Date.now()}`;
    const resolvedDueDate = purchase.dueDate || purchase.transactionDatetime.split('T')[0];
    db.prepare(`
      INSERT INTO vendor_invoices (id, vendor_id, invoice_number, issue_date, due_date, subtotal, total, paid_amount, remaining_balance, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceId, vendorId, invoiceNumber, purchase.transactionDatetime.split('T')[0], resolvedDueDate, invoiceTotal, invoiceTotal, purchase.paidAmount, invoiceTotal - purchase.paidAmount, (invoiceTotal - purchase.paidAmount) <= 0 ? 'Paid' : 'Pending', now, now);

    // 3. Insert items and update stock
    for (const item of purchase.items) {
      const itemId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, invoiceId, item.productId, item.quantity, item.ratePerUnit, item.quantity * item.ratePerUnit, now, now);

      db.prepare(`UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?`)
        .run(item.quantity, now, item.productId);
    }

    // 4. Create vendor_ledger
    db.prepare(`
      INSERT INTO vendor_ledger (id, vendor_id, transaction_datetime, description, vehicle_number,
        total_payment, paid_amount, remaining_balance, created_at, updated_at, vendor_invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, vendorId, purchase.transactionDatetime, purchase.description ?? null, purchase.vehicleNumber ?? null,
      purchase.totalPayment, purchase.paidAmount, remainingBalance, now, now, invoiceId);
  });

  transaction();
  return getVendorLedgerById(ledgerId);
}

export function updateVendorLedgerEntry(
  id: string, vendorId: string, transactionDatetime: string,
  items: { productId: string; quantity: number; ratePerUnit: number }[],
  totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string,
  dueDate?: string
) {
  const db = getDatabase();
  const existing = getVendorLedgerById(id);
  if (!existing) throw new Error('Vendor ledger entry not found');

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    const remainingBalance = totalPayment - paidAmount;

    updateRow(db, 'vendor_ledger', id, {
      vendor_id: vendorId,
      transaction_datetime: transactionDatetime,
      total_payment: totalPayment,
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      description: description ?? null,
      vehicle_number: vehicleNumber ?? null,
    });

    if (existing.vendor_invoice_id) {
      const oldItems = db.prepare(
        `SELECT product_id, quantity FROM vendor_invoice_items WHERE vendor_invoice_id = ? AND deleted_at IS NULL`
      ).all(existing.vendor_invoice_id) as { product_id: string; quantity: number }[];

      if (!itemsAreEqual(oldItems, items)) {
        for (const old of oldItems) {
          db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?')
            .run(old.quantity, now, old.product_id);
        }

        db.prepare(
          'UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_invoice_id = ? AND deleted_at IS NULL'
        ).run(now, now, existing.vendor_invoice_id);

        for (const item of items) {
          const itemId = crypto.randomUUID();
          db.prepare(
            `INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(itemId, existing.vendor_invoice_id, item.productId, item.quantity, item.ratePerUnit, item.quantity * item.ratePerUnit, now, now);
          db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?')
            .run(item.quantity, now, item.productId);
        }
      }

      const invoiceTotal = items.reduce((sum, it) => sum + (it.quantity * it.ratePerUnit), 0);
      const issueDate = transactionDatetime.split('T')[0];
      const resolvedDueDate = dueDate !== undefined ? (dueDate || issueDate) : issueDate;
      updateRow(db, 'vendor_invoices', existing.vendor_invoice_id, {
        total: invoiceTotal,
        subtotal: invoiceTotal,
        issue_date: issueDate,
        due_date: resolvedDueDate,
      });

      syncVendorInvoiceFromLedger(db, existing.vendor_invoice_id, now);
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
    const now = new Date().toISOString();

    // Cascade: soft-delete linked invoice + items, and reverse inventory
    if (entry.vendor_invoice_id) {
      const items = db.prepare(`SELECT product_id, quantity FROM vendor_invoice_items WHERE vendor_invoice_id = ? AND deleted_at IS NULL`).all(entry.vendor_invoice_id) as { product_id: string; quantity: number }[];
      for (const item of items) {
        db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?').run(item.quantity, now, item.product_id);
      }

      db.prepare('UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_invoice_id = ? AND deleted_at IS NULL')
        .run(now, now, entry.vendor_invoice_id);
      db.prepare('UPDATE vendor_invoices SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ? AND deleted_at IS NULL')
        .run(now, now, entry.vendor_invoice_id);
    }

    // Soft-delete the ledger entry itself (last)
    softDeleteRow(db, 'vendor_ledger', id);
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

export function getPendingVendorLedgerEntries(vendorId: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT vl.*, v.name as vendor_name, i.name as product_name
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    LEFT JOIN inventory i ON i.id = vl.product_id
    WHERE vl.deleted_at IS NULL
      AND vl.vendor_id = ?
      AND vl.vendor_invoice_id IS NULL
    ORDER BY vl.transaction_datetime DESC
  `).all(vendorId) as (VendorLedgerRow & { vendor_name: string; product_name: string })[];
}

export function linkEntriesToInvoice(entryIds: string[], invoiceId: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE vendor_ledger SET vendor_invoice_id = ?, updated_at = ?, synced = 0 WHERE id = ?');
  const transaction = db.transaction(() => {
    for (const id of entryIds) {
      stmt.run(invoiceId, now, id);
    }
    syncVendorInvoiceFromLedger(db, invoiceId, now);
  });
  transaction();
}
