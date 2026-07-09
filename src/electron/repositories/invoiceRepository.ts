import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface InvoiceRow {
  id: string
  customer_id: string
  invoice_number: string
  issue_date: string
  due_date: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  paid_amount: number
  remaining_balance: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface InvoiceItemRow {
  id: string
  invoice_id: string
  product_id: string
  quantity: number
  rate_per_unit: number
  total: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface InvoiceItemInput {
  productId: string
  quantity: number
  ratePerUnit: number
}

function nowISO(): string {
  return new Date().toISOString();
}

export function getAllInvoices(
  status?: string, customerId?: string,
  dateFrom?: string, dateTo?: string,
  page = 1, limit = 20
) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE i.deleted_at IS NULL';
  const params: unknown[] = [];

  if (status) {
    where += ' AND i.status = ?';
    params.push(status);
  }
  if (customerId) {
    where += ' AND i.customer_id = ?';
    params.push(customerId);
  }
  if (dateFrom) {
    where += ' AND i.issue_date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND i.issue_date <= ?';
    params.push(dateTo);
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM invoices i ${where}
  `).get(...params) as { total: number };

  const data = db.prepare(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    ${where}
    ORDER BY i.issue_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (InvoiceRow & { customer_name: string })[];

  return { data, total: countRow.total, page, limit };
}

export function getInvoiceById(id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.id = ? AND i.deleted_at IS NULL
  `).get(id) as (InvoiceRow & { customer_name: string }) | undefined;
}

export function getInvoiceItems(invoiceId: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT ii.*, inv.name as product_name, inv.unit
    FROM invoice_items ii
    LEFT JOIN inventory inv ON inv.id = ii.product_id
    WHERE ii.invoice_id = ? AND ii.deleted_at IS NULL
    ORDER BY ii.created_at ASC
  `).all(invoiceId) as (InvoiceItemRow & { product_name: string; unit: string })[];
}

export function getInvoiceWithItems(id: string) {
  const invoice = getInvoiceById(id);
  if (!invoice) return undefined;
  const items = getInvoiceItems(id);
  return { ...invoice, items };
}

export function createInvoice(
  customerId: string, invoiceNumber: string, issueDate: string, dueDate: string,
  subtotal: number, taxAmount: number, discountAmount: number, total: number,
  paidAmount: number, notes: string | undefined,
  items: InvoiceItemInput[]
) {
  const db = getDatabase();
  const now = nowISO();
  const id = crypto.randomUUID();
  const remainingBalance = total - paidAmount;
  const status = remainingBalance <= 0 ? 'Paid' : 'Pending';

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (id, customer_id, invoice_number, issue_date, due_date,
      subtotal, tax_amount, discount_amount, total, paid_amount, remaining_balance,
      status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertInvoice.run(id, customerId, invoiceNumber, issueDate, dueDate,
      subtotal, taxAmount, discountAmount, total, paidAmount, remainingBalance,
      status, notes ?? null, now, now);

    for (const item of items) {
      const itemTotal = item.quantity * item.ratePerUnit;
      insertItem.run(crypto.randomUUID(), id, item.productId, item.quantity, item.ratePerUnit, itemTotal, now, now);
    }
  });

  transaction();
  return getInvoiceWithItems(id);
}

export function updateInvoice(
  id: string, customerId: string, invoiceNumber: string,
  issueDate: string, dueDate: string, subtotal: number,
  taxAmount: number, discountAmount: number, total: number,
  paidAmount: number, status: string, notes?: string
) {
  const db = getDatabase();
  const remainingBalance = total - paidAmount;

  updateRow(db, 'invoices', id, {
    customer_id: customerId,
    invoice_number: invoiceNumber,
    issue_date: issueDate,
    due_date: dueDate,
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    total,
    paid_amount: paidAmount,
    remaining_balance: remainingBalance,
    status,
    notes: notes ?? null,
  });

  return getInvoiceById(id);
}

export function replaceInvoiceItems(invoiceId: string, items: InvoiceItemInput[]) {
  const db = getDatabase();
  const now = nowISO();

  const existingItems = getInvoiceItems(invoiceId);
  const softDeleteOld = db.prepare(`
    UPDATE invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?
  `);
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const old of existingItems) {
      softDeleteOld.run(now, now, old.id);
    }
    for (const item of items) {
      const itemTotal = item.quantity * item.ratePerUnit;
      insertItem.run(crypto.randomUUID(), invoiceId, item.productId, item.quantity, item.ratePerUnit, itemTotal, now, now);
    }
  });

  transaction();
  return getInvoiceWithItems(invoiceId);
}

export function softDeleteInvoice(id: string) {
  const db = getDatabase();
  const now = nowISO();

  const transaction = db.transaction(() => {
    softDeleteRow(db, 'invoices', id);
    db.prepare('UPDATE invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE invoice_id = ? AND deleted_at IS NULL').run(now, now, id);
  });

  transaction();
}

export function markInvoiceAsPaid(id: string) {
  const db = getDatabase();
  const existing = getInvoiceById(id);
  if (!existing) throw new Error('Invoice not found');

  updateRow(db, 'invoices', id, {
    paid_amount: existing.total,
    remaining_balance: 0,
    status: 'Paid',
  });

  return getInvoiceById(id);
}

export function getInvoicesSummary() {
  const db = getDatabase();
  const totalReceivables = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM invoices WHERE deleted_at IS NULL AND status IN ('Pending', 'Overdue')
  `).get() as { total: number };

  const pendingTotal = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM invoices WHERE deleted_at IS NULL AND status = 'Pending'
  `).get() as { total: number };

  const overdueTotal = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM invoices WHERE deleted_at IS NULL AND status = 'Overdue'
  `).get() as { total: number };

  const paidTotal = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM invoices WHERE deleted_at IS NULL AND status = 'Paid'
  `).get() as { total: number };

  return {
    totalReceivables: totalReceivables.total,
    pendingTotal: pendingTotal.total,
    overdueTotal: overdueTotal.total,
    paidTotal: paidTotal.total,
  };
}

export function getTodayInvoiceTotal() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM invoices WHERE deleted_at IS NULL AND issue_date = ?
  `).get(today) as { total: number };
  return row.total;
}
