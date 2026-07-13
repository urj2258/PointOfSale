import Database from 'better-sqlite3';
import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';
import { insertCustomerInTx } from './customerRepository.js';


export interface CustomerLedgerRow {
  id: string
  customer_id: string
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
  invoice_id: string | null
}

function syncCustomerInvoiceFromLedger(db: Database.Database, invoiceId: string, now: string) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(paid_amount), 0) as totalPaid
    FROM customer_ledger
    WHERE invoice_id = ? AND deleted_at IS NULL
  `).get(invoiceId) as { totalPaid: number };

  const invoice = db.prepare('SELECT total FROM invoices WHERE id = ? AND deleted_at IS NULL').get(invoiceId) as { total: number } | undefined;
  if (!invoice) return;

  const remainingBalance = Math.max(0, invoice.total - row.totalPaid);
  const status = remainingBalance <= 0 ? 'Paid' : 'Pending';

  updateRow(db, 'invoices', invoiceId, {
    paid_amount: row.totalPaid,
    remaining_balance: remainingBalance,
    status,
  });
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
    SELECT cl.*, c.name as customer_name,
           inv.due_date as invoice_due_date,
           (SELECT group_concat(i.name, ', ') FROM invoice_items ii JOIN inventory i ON i.id = ii.product_id WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as product_name,
           (SELECT SUM(quantity) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as quantity,
           (SELECT AVG(rate_per_unit) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as rate_per_unit
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN invoices inv ON inv.id = cl.invoice_id
    ${where}
    ORDER BY cl.transaction_datetime DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (CustomerLedgerRow & { customer_name: string; product_name: string; quantity: number; rate_per_unit: number; invoice_due_date: string | null })[];

  return { data, total: countRow.total, page, limit };
}

export function getCustomerLedgerById(id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT cl.*, c.name as customer_name,
           inv.due_date as invoice_due_date,
           (SELECT group_concat(i.name, ', ') FROM invoice_items ii JOIN inventory i ON i.id = ii.product_id WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as product_name,
           (SELECT SUM(quantity) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as quantity,
           (SELECT AVG(rate_per_unit) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as rate_per_unit
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN invoices inv ON inv.id = cl.invoice_id
    WHERE cl.id = ? AND cl.deleted_at IS NULL
  `).get(id) as (CustomerLedgerRow & { customer_name: string; product_name: string; quantity: number; rate_per_unit: number; invoice_due_date: string | null }) | undefined;
}

export function createMultiItemSale(
  customer: { id?: string; name: string; phone: string; address: string; shop_name?: string },
  sale: {
    items: { productId: string; quantity: number; ratePerUnit: number }[];
    transactionDatetime: string; totalPayment: number; paidAmount: number;
    description?: string; vehicleNumber?: string; dueDate?: string;
  }
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const customerId = customer.id || crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const invoiceId = crypto.randomUUID();
  const remainingBalance = sale.totalPayment - sale.paidAmount;

  const transaction = db.transaction(() => {
    // 1. Insert the new customer if no ID was provided
    if (!customer.id) {
      insertCustomerInTx(db, customerId, now, customer.name, customer.phone, customer.address, customer.shop_name);
    }

    // 2. Create invoice
    const invoiceTotal = sale.items.reduce((sum, it) => sum + (it.quantity * it.ratePerUnit), 0);
    const invoiceNumber = `INV-${Date.now()}`;
    const resolvedDueDate = sale.dueDate || sale.transactionDatetime.split('T')[0];
    
    db.prepare(`
      INSERT INTO invoices (id, customer_id, invoice_number, issue_date, due_date, subtotal, total, paid_amount, remaining_balance, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceId, customerId, invoiceNumber, sale.transactionDatetime.split('T')[0], resolvedDueDate, invoiceTotal, invoiceTotal, sale.paidAmount, invoiceTotal - sale.paidAmount, (invoiceTotal - sale.paidAmount) <= 0 ? 'Paid' : 'Pending', now, now);

    // 3. Insert items and deduct stock
    const checkStock = db.prepare('SELECT name, quantity FROM inventory WHERE id = ? AND deleted_at IS NULL');
    
    // Validate all requested items before proceeding
    for (const item of sale.items) {
      const row = checkStock.get(item.productId) as { name: string; quantity: number } | undefined;
      if (!row) {
        throw new Error(`Product not found in inventory (id: ${item.productId})`);
      }
      if (item.quantity > row.quantity) {
        throw new Error(
          `Insufficient stock for "${row.name}". Available: ${row.quantity}, Requested: ${item.quantity}`
        );
      }
    }

    for (const item of sale.items) {
      const itemId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, invoiceId, item.productId, item.quantity, item.ratePerUnit, item.quantity * item.ratePerUnit, now, now);

      const result = db.prepare(`UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?`)
        .run(item.quantity, now, item.productId);
      if (result.changes === 0) throw new Error('Product not found in inventory');
    }

    // 4. Create customer_ledger entry
    db.prepare(`
      INSERT INTO customer_ledger (id, customer_id, transaction_datetime, description, vehicle_number,
        total_payment, paid_amount, remaining_balance, created_at, updated_at, invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, customerId, sale.transactionDatetime, sale.description ?? null, sale.vehicleNumber ?? null,
      sale.totalPayment, sale.paidAmount, remainingBalance, now, now, invoiceId);
  });

  transaction();
  return getCustomerLedgerById(ledgerId);
}

export function updateMultiItemSale(
  id: string, customerId: string, transactionDatetime: string,
  items: { productId: string; quantity: number; ratePerUnit: number }[],
  totalPayment: number, paidAmount: number, description?: string, vehicleNumber?: string,
  dueDate?: string
) {
  const db = getDatabase();
  const existing = getCustomerLedgerById(id);
  if (!existing) throw new Error('Customer ledger entry not found');

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    const remainingBalance = totalPayment - paidAmount;

    updateRow(db, 'customer_ledger', id, {
      customer_id: customerId,
      transaction_datetime: transactionDatetime,
      total_payment: totalPayment,
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      description: description ?? null,
      vehicle_number: vehicleNumber ?? null,
    });

    if (existing.invoice_id) {
      // 1. Load old items so we can restore their inventory contribution
      const oldItems = db.prepare(
        `SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ? AND deleted_at IS NULL`
      ).all(existing.invoice_id) as { product_id: string; quantity: number }[];

      // 2. Restore old stock (customer sales SUBTRACT stock, so restore = ADD back)
      for (const old of oldItems) {
        db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?')
          .run(old.quantity, now, old.product_id);
      }

      // 3. Soft-delete ALL existing items for this invoice
      db.prepare(
        'UPDATE invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE invoice_id = ? AND deleted_at IS NULL'
      ).run(now, now, existing.invoice_id);

      // 4. Insert fresh items and deduct new stock
      const checkStock = db.prepare('SELECT name, quantity FROM inventory WHERE id = ? AND deleted_at IS NULL');
      
      for (const item of items) {
        const row = checkStock.get(item.productId) as { name: string; quantity: number } | undefined;
        if (!row) throw new Error(`Product not found in inventory (id: ${item.productId})`);
        
        // Note: quantity here includes the old stock we just restored (since we did UPDATE inventory SET quantity = quantity + old)
        if (item.quantity > row.quantity) {
          throw new Error(`Insufficient stock for "${row.name}". Available: ${row.quantity}, Requested: ${item.quantity}`);
        }
      }

      for (const item of items) {
        const itemId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(itemId, existing.invoice_id, item.productId, item.quantity, item.ratePerUnit, item.quantity * item.ratePerUnit, now, now);
        const result = db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?')
          .run(item.quantity, now, item.productId);
        if (result.changes === 0) throw new Error('Product not found in inventory');
      }

      // 5. Update invoice header totals, issue date, due date
      const invoiceTotal = items.reduce((sum, it) => sum + (it.quantity * it.ratePerUnit), 0);
      const issueDate = transactionDatetime.split('T')[0];
      const resolvedDueDate = dueDate || issueDate;
      updateRow(db, 'invoices', existing.invoice_id, {
        total: invoiceTotal,
        subtotal: invoiceTotal,
        customer_id: customerId,
        issue_date: issueDate,
        due_date: resolvedDueDate,
      });

      syncCustomerInvoiceFromLedger(db, existing.invoice_id, now);
    }
  });

  transaction();
  return getCustomerLedgerById(id);
}


export function softDeleteCustomerLedgerEntry(id: string) {
  const db = getDatabase();
  const entry = getCustomerLedgerById(id);
  if (!entry) throw new Error('Customer ledger entry not found');

  const transaction = db.transaction(() => {
    const now = new Date().toISOString();

    // Cascade: soft-delete linked invoice + items
    if (entry.invoice_id) {
      const items = db.prepare(`SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ? AND deleted_at IS NULL`).all(entry.invoice_id) as { product_id: string; quantity: number }[];
      for (const item of items) {
        db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?').run(item.quantity, now, item.product_id);
      }

      db.prepare('UPDATE invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE invoice_id = ? AND deleted_at IS NULL')
        .run(now, now, entry.invoice_id);
      db.prepare('UPDATE invoices SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ? AND deleted_at IS NULL')
        .run(now, now, entry.invoice_id);
    }

    // Soft-delete the ledger entry itself (last)
    softDeleteRow(db, 'customer_ledger', id);
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

export function getPendingCustomerLedgerEntries(customerId: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT cl.*, c.name as customer_name, i.name as product_name
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN inventory i ON i.id = cl.product_id
    WHERE cl.deleted_at IS NULL
      AND cl.customer_id = ?
      AND cl.invoice_id IS NULL
    ORDER BY cl.transaction_datetime DESC
  `).all(customerId) as (CustomerLedgerRow & { customer_name: string; product_name: string })[];
}

export function linkEntriesToInvoice(entryIds: string[], invoiceId: string) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE customer_ledger SET invoice_id = ?, updated_at = ?, synced = 0 WHERE id = ?');
  const transaction = db.transaction(() => {
    for (const id of entryIds) {
      stmt.run(invoiceId, now, id);
    }
    syncCustomerInvoiceFromLedger(db, invoiceId, now);
  });
  transaction();
}
