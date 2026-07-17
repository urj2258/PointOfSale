import Database from 'better-sqlite3';
import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';
import { insertCustomerInTx } from './customerRepository.js';
import ExcelJS from 'exceljs';
import path from 'path';

const C = {
  dark: 'FF111827', blue: 'FF2563EB', bluePale: 'FFDBEAFE',
  green: 'FF059669', red: 'FFDC2626',
  greenBg: 'FFD1FAE5', redBg: 'FFFEE2E2', grayBg: 'FFF9FAFB',
  border: 'FFE5E7EB', white: 'FFFFFFFF', muted: 'FF6B7280',
};

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
      const oldItems = db.prepare(
        `SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ? AND deleted_at IS NULL`
      ).all(existing.invoice_id) as { product_id: string; quantity: number }[];

      if (!itemsAreEqual(oldItems, items)) {
        for (const old of oldItems) {
          db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = ?, synced = 0 WHERE id = ?')
            .run(old.quantity, now, old.product_id);
        }

        db.prepare(
          'UPDATE invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE invoice_id = ? AND deleted_at IS NULL'
        ).run(now, now, existing.invoice_id);

        const checkStock = db.prepare('SELECT name, quantity FROM inventory WHERE id = ? AND deleted_at IS NULL');

        for (const item of items) {
          const row = checkStock.get(item.productId) as { name: string; quantity: number } | undefined;
          if (!row) throw new Error(`Product not found in inventory (id: ${item.productId})`);

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
      }

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

export async function exportCustomerLedgerExcel(customerId: string, fromDate?: string, toDate?: string, exportDir?: string): Promise<{ buffer: Buffer; filePath: string }> {
  const db = getDatabase();

  let where = 'WHERE cl.deleted_at IS NULL AND cl.customer_id = ?';
  const params: unknown[] = [customerId];

  if (fromDate) {
    where += ' AND cl.transaction_datetime >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    where += ' AND cl.transaction_datetime <= ?';
    params.push(toDate);
  }

  const rows = db.prepare(`
    SELECT cl.*, c.name as customer_name, inv.invoice_number,
           (SELECT SUM(ii.quantity) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as quantity,
           (SELECT AVG(ii.rate_per_unit) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as rate_per_unit
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN invoices inv ON inv.id = cl.invoice_id
    ${where}
    ORDER BY cl.transaction_datetime ASC
  `).all(...params) as (CustomerLedgerRow & { customer_name: string; invoice_number: string | null; quantity: number | null; rate_per_unit: number | null })[];

  if (rows.length === 0) {
    throw new Error('No entries found in this date range');
  }

  const customerName = rows[0].customer_name || 'Customer';

  const safeFrom = fromDate ? fromDate.replace(/[^0-9-]/g, '') : '';
  const safeTo = toDate ? toDate.replace(/[^0-9-]/g, '') : '';
  const dateSuffix = safeFrom && safeTo ? `_${safeFrom}_to_${safeTo}` : '';
  const safeCustomerName = customerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Customer_Ledger_${safeCustomerName}${dateSuffix}.xlsx`;
  const filePath = path.join(exportDir || '', fileName);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Customer Ledger', {
    properties: { defaultRowHeight: 25 }
  });

  sheet.columns = [
    { header: 'Date', key: 'date', width: 22 },
    { header: 'Invoice #', key: 'invoice', width: 18 },
    { header: 'Description', key: 'desc', width: 35 },
    { header: 'Quantity', key: 'qty', width: 12 },
    { header: 'Rate', key: 'rate', width: 18 },
    { header: 'Total Payment', key: 'total', width: 20 },
    { header: 'Paid Amount', key: 'paid', width: 20 },
    { header: 'Balance', key: 'balance', width: 20 },
  ];

  sheet.spliceRows(1, 0, []);

  sheet.mergeCells('A1:H1');
  const title = sheet.getCell('A1');
  title.value = `Customer Ledger Report`;
  title.font = { name: 'Inter', size: 16, bold: true, color: { argb: C.white } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.mergeCells('A2:H2');
  const subtitle = sheet.getCell('A2');
  if (fromDate && toDate) {
    subtitle.value = `${customerName} | ${fromDate} → ${toDate}`;
  } else {
    subtitle.value = customerName;
  }
  subtitle.font = { name: 'Inter', size: 12, bold: true, color: { argb: C.white } };
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blue } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'center' };

  // Empty row for spacing
  sheet.addRow([]);

  const headerRowObj = sheet.addRow(['Date', 'Invoice #', 'Description', 'Quantity', 'Rate', 'Total Payment', 'Paid Amount', 'Remaining Balance']);
  headerRowObj.font = { name: 'Inter', size: 11, color: { argb: C.muted } };
  headerRowObj.alignment = { vertical: 'middle', horizontal: 'left' };
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
    headerRowObj.getCell(col).border = {
      bottom: { style: 'thin', color: { argb: C.border } }
    };
  });
  headerRowObj.getCell('D').alignment = { horizontal: 'right' };
  headerRowObj.getCell('E').alignment = { horizontal: 'right' };
  headerRowObj.getCell('F').alignment = { horizontal: 'right' };
  headerRowObj.getCell('G').alignment = { horizontal: 'right' };
  headerRowObj.getCell('H').alignment = { horizontal: 'right' };

  const numFmt = '"Rs."#,##0.00';
  let totalPurchases = 0;
  let totalPaid = 0;

  for (const row of rows) {
    const sheetRow = sheet.addRow({
      date: row.transaction_datetime,
      invoice: row.invoice_number || '-',
      desc: row.description || '-',
      qty: row.quantity ?? '-',
      rate: row.rate_per_unit ?? '-',
      total: row.total_payment,
      paid: row.paid_amount,
      balance: row.remaining_balance,
    });
    
    totalPurchases += row.total_payment;
    totalPaid += row.paid_amount;

    sheetRow.font = { name: 'Inter', size: 10, color: { argb: C.dark } };
    sheetRow.getCell('rate').numFmt = numFmt;
    sheetRow.getCell('total').numFmt = numFmt;
    sheetRow.getCell('paid').numFmt = numFmt;
    sheetRow.getCell('balance').numFmt = numFmt;
    sheetRow.alignment = { vertical: 'middle' };
    sheetRow.getCell('date').alignment = { horizontal: 'left' };

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
      sheetRow.getCell(col).border = { bottom: { style: 'thin', color: { argb: C.border } } };
    });
  }

  sheet.addRow([]);
  const totalsRow = sheet.addRow({
    date: 'TOTAL',
    invoice: '',
    desc: '',
    qty: '',
    rate: '',
    total: totalPurchases,
    paid: totalPaid,
    balance: totalPurchases - totalPaid
  });
  
  totalsRow.font = { name: 'Inter', size: 11, bold: true, color: { argb: C.dark } };
  totalsRow.getCell('total').numFmt = numFmt;
  totalsRow.getCell('paid').numFmt = numFmt;
  totalsRow.getCell('balance').numFmt = numFmt;
  totalsRow.alignment = { vertical: 'middle', horizontal: 'right' };
  totalsRow.getCell('date').alignment = { horizontal: 'left' };
  
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
    totalsRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bluePale } };
  });

  const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
  return { buffer, filePath };
}
