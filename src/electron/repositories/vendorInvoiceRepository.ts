import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';

export interface VendorInvoiceRow {
  id: string
  vendor_id: string
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

export interface VendorInvoiceItemRow {
  id: string
  vendor_invoice_id: string
  product_id: string
  quantity: number
  rate_per_unit: number
  total: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export interface VendorInvoiceItemInput {
  productId: string
  quantity: number
  ratePerUnit: number
}

function nowISO(): string {
  return new Date().toISOString();
}

export function getAllVendorInvoices(
  status?: string, vendorId?: string,
  dateFrom?: string, dateTo?: string,
  page = 1, limit = 20
) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  let where = 'WHERE vi.deleted_at IS NULL';
  const params: unknown[] = [];

  if (status) {
    where += ' AND vi.status = ?';
    params.push(status);
  }
  if (vendorId) {
    where += ' AND vi.vendor_id = ?';
    params.push(vendorId);
  }
  if (dateFrom) {
    where += ' AND vi.issue_date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND vi.issue_date <= ?';
    params.push(dateTo);
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM vendor_invoices vi ${where}
  `).get(...params) as { total: number };

  const data = db.prepare(`
    SELECT vi.*, v.name as vendor_name
    FROM vendor_invoices vi
    LEFT JOIN vendors v ON v.id = vi.vendor_id
    ${where}
    ORDER BY vi.issue_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (VendorInvoiceRow & { vendor_name: string })[];

  return { data, total: countRow.total, page, limit };
}

export function getVendorInvoiceById(id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT vi.*, v.name as vendor_name
    FROM vendor_invoices vi
    LEFT JOIN vendors v ON v.id = vi.vendor_id
    WHERE vi.id = ? AND vi.deleted_at IS NULL
  `).get(id) as (VendorInvoiceRow & { vendor_name: string }) | undefined;
}

export function getVendorInvoiceItems(vendorInvoiceId: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT vii.*, inv.name as product_name, inv.unit
    FROM vendor_invoice_items vii
    LEFT JOIN inventory inv ON inv.id = vii.product_id
    WHERE vii.vendor_invoice_id = ? AND vii.deleted_at IS NULL
    ORDER BY vii.created_at ASC
  `).all(vendorInvoiceId) as (VendorInvoiceItemRow & { product_name: string; unit: string })[];
}

export function getVendorInvoiceWithItems(id: string) {
  const invoice = getVendorInvoiceById(id);
  if (!invoice) return undefined;
  const items = getVendorInvoiceItems(id);
  return { ...invoice, items };
}

export function createVendorInvoice(
  vendorId: string, invoiceNumber: string, issueDate: string, dueDate: string,
  subtotal: number, taxAmount: number, discountAmount: number, total: number,
  paidAmount: number, notes: string | undefined,
  items: VendorInvoiceItemInput[]
) {
  const db = getDatabase();
  const now = nowISO();
  const id = crypto.randomUUID();
  const remainingBalance = total - paidAmount;
  const status = remainingBalance <= 0 ? 'Paid' : 'Pending';

  const insertInvoice = db.prepare(`
    INSERT INTO vendor_invoices (id, vendor_id, invoice_number, issue_date, due_date,
      subtotal, tax_amount, discount_amount, total, paid_amount, remaining_balance,
      status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertInvoice.run(id, vendorId, invoiceNumber, issueDate, dueDate,
      subtotal, taxAmount, discountAmount, total, paidAmount, remainingBalance,
      status, notes ?? null, now, now);

    for (const item of items) {
      const itemTotal = item.quantity * item.ratePerUnit;
      insertItem.run(crypto.randomUUID(), id, item.productId, item.quantity, item.ratePerUnit, itemTotal, now, now);
    }
  });

  transaction();
  return getVendorInvoiceWithItems(id);
}

export function updateVendorInvoice(
  id: string, vendorId: string, invoiceNumber: string,
  issueDate: string, dueDate: string, subtotal: number,
  taxAmount: number, discountAmount: number, total: number,
  paidAmount: number, status: string, notes?: string
) {
  const db = getDatabase();
  const remainingBalance = total - paidAmount;

  updateRow(db, 'vendor_invoices', id, {
    vendor_id: vendorId,
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

  return getVendorInvoiceById(id);
}

export function replaceVendorInvoiceItems(invoiceId: string, items: VendorInvoiceItemInput[]) {
  const db = getDatabase();
  const now = nowISO();

  const existingItems = getVendorInvoiceItems(invoiceId);
  const softDeleteOld = db.prepare(`
    UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?
  `);
  const insertItem = db.prepare(`
    INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
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
  return getVendorInvoiceWithItems(invoiceId);
}

export function softDeleteVendorInvoice(id: string) {
  const db = getDatabase();
  const now = nowISO();

  const transaction = db.transaction(() => {
    softDeleteRow(db, 'vendor_invoices', id);
    db.prepare('UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_invoice_id = ? AND deleted_at IS NULL').run(now, now, id);
  });

  transaction();
}

export function markVendorInvoiceAsPaid(id: string) {
  const db = getDatabase();
  const existing = getVendorInvoiceById(id);
  if (!existing) throw new Error('Vendor invoice not found');

  updateRow(db, 'vendor_invoices', id, {
    paid_amount: existing.total,
    remaining_balance: 0,
    status: 'Paid',
  });

  return getVendorInvoiceById(id);
}

export function getVendorInvoicesSummary() {
  const db = getDatabase();
  const totalPayables = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM vendor_invoices WHERE deleted_at IS NULL AND status IN ('Pending', 'Overdue')
  `).get() as { total: number };

  const pendingTotal = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM vendor_invoices WHERE deleted_at IS NULL AND status = 'Pending'
  `).get() as { total: number };

  const overdueTotal = db.prepare(`
    SELECT COALESCE(SUM(remaining_balance), 0) as total
    FROM vendor_invoices WHERE deleted_at IS NULL AND status = 'Overdue'
  `).get() as { total: number };

  const paidTotal = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM vendor_invoices WHERE deleted_at IS NULL AND status = 'Paid'
  `).get() as { total: number };

  return {
    totalPayables: totalPayables.total,
    pendingTotal: pendingTotal.total,
    overdueTotal: overdueTotal.total,
    paidTotal: paidTotal.total,
  };
}

export function getTodayVendorInvoiceTotal() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM vendor_invoices WHERE deleted_at IS NULL AND issue_date = ?
  `).get(today) as { total: number };
  return row.total;
}
