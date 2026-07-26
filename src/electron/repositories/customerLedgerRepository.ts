import Database from 'better-sqlite3';
import { getDatabase } from '../database.js';
import { updateRow, softDeleteRow } from '../dbHelpers.js';
import crypto from 'crypto';
import { insertCustomerInTx } from './customerRepository.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { BUSINESS_NAME, BUSINESS_PHONE, C } from '../constants.js';

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
  transaction_type: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
  invoice_id: string | null
  linked_entry_id: string | null
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
           c.opening_balance + SUM(cl.total_payment - cl.paid_amount) OVER (PARTITION BY cl.customer_id ORDER BY cl.transaction_datetime ASC, cl.id ASC) as running_balance,
           inv.due_date as invoice_due_date,
           inv.invoice_number,
           (SELECT group_concat(i.name, ', ') FROM invoice_items ii JOIN inventory i ON i.id = ii.product_id WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as product_name,
           (SELECT SUM(quantity) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as quantity,
           (SELECT AVG(rate_per_unit) FROM invoice_items ii WHERE ii.invoice_id = cl.invoice_id AND ii.deleted_at IS NULL) as rate_per_unit
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    LEFT JOIN invoices inv ON inv.id = cl.invoice_id
    ${where}
    ORDER BY cl.transaction_datetime ASC, cl.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as (CustomerLedgerRow & { customer_name: string; product_name: string; quantity: number; rate_per_unit: number; running_balance: number; invoice_due_date: string | null; invoice_number: string | null })[];

  const parsed = data.map(row => ({
    ...row,
    running_balance: row.running_balance ?? 0,
  }));

  return { data: parsed, total: countRow.total, page, limit };
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
  customer: { id?: string; name: string; phone: string; address: string; shop_name?: string; opening_balance?: number },
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
      insertCustomerInTx(db, customerId, now, customer.name, customer.phone, customer.address, customer.shop_name, customer.opening_balance ?? 0);
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

    // Cascade: delete linked vendor_ledger payment entry (if any)
    if (entry.linked_entry_id) {
      const linked = db.prepare('SELECT id, vendor_invoice_id, deleted_at FROM vendor_ledger WHERE id = ?').get(entry.linked_entry_id) as { id: string; vendor_invoice_id: string | null; deleted_at: string | null } | undefined;
      if (linked && !linked.deleted_at) {
        if (linked.vendor_invoice_id) {
          const linkedItems = db.prepare('SELECT product_id, quantity FROM vendor_invoice_items WHERE vendor_invoice_id = ? AND deleted_at IS NULL').all(linked.vendor_invoice_id) as { product_id: string; quantity: number }[];
          for (const item of linkedItems) {
            db.prepare('UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?').run(item.quantity, now, item.product_id);
          }
          db.prepare('UPDATE vendor_invoice_items SET deleted_at = ?, updated_at = ?, synced = 0 WHERE vendor_invoice_id = ? AND deleted_at IS NULL').run(now, now, linked.vendor_invoice_id);
          db.prepare('UPDATE vendor_invoices SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ? AND deleted_at IS NULL').run(now, now, linked.vendor_invoice_id);
        }
        softDeleteRow(db, 'vendor_ledger', entry.linked_entry_id);
      }
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

  const customer = db.prepare('SELECT name, shop_name, opening_balance FROM customers WHERE id = ?').get(customerId) as { name: string; shop_name: string | null; opening_balance: number } | undefined;
  if (!customer) throw new Error('Customer not found');

  const customerName = customer.name;
  const shopName = customer.shop_name;
  const openingBalance = customer.opening_balance;

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
    ORDER BY cl.transaction_datetime ASC, cl.id ASC
  `).all(...params) as (CustomerLedgerRow & { customer_name: string; invoice_number: string | null; quantity: number | null; rate_per_unit: number | null })[];

  if (rows.length === 0) {
    throw new Error('No entries found in this date range');
  }

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

  // Row 1: Business name
  sheet.mergeCells('A1:H1');
  const businessRow = sheet.getCell('A1');
  businessRow.value = BUSINESS_NAME;
  businessRow.font = { name: 'Inter', size: 14, bold: true, color: { argb: C.white } };
  businessRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
  businessRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Business name & phone
  sheet.mergeCells('A2:H2');
  const infoRow = sheet.getCell('A2');
  infoRow.value = `${BUSINESS_NAME} - ${BUSINESS_PHONE}`;
  infoRow.font = { name: 'Inter', size: 10, color: { argb: C.white } };
  infoRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blue } };
  infoRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 3: Report title
  sheet.mergeCells('A3:H3');
  const title = sheet.getCell('A3');
  title.value = 'Customer Ledger Report';
  title.font = { name: 'Inter', size: 16, bold: true, color: { argb: C.white } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 4: Subtitle with customer name, shop name, date range
  sheet.mergeCells('A4:H4');
  const subtitle = sheet.getCell('A4');
  const shopPart = shopName ? ` | ${shopName}` : '';
  if (fromDate && toDate) {
    subtitle.value = `${customerName}${shopPart} | ${fromDate} \u2192 ${toDate}`;
  } else {
    subtitle.value = `${customerName}${shopPart}`;
  }
  subtitle.font = { name: 'Inter', size: 12, bold: true, color: { argb: C.white } };
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blue } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'center' };

  // Gap row
  sheet.addRow([]);

  // Opening Balance row
  const numFmt = '"Rs."#,##0.00';
  const obSheetRow = sheet.addRow({
    date: 'Opening Balance',
    invoice: '',
    desc: '',
    qty: '',
    rate: '',
    total: '',
    paid: '',
    balance: openingBalance,
  });
  obSheetRow.font = { name: 'Inter', size: 11, bold: true, color: { argb: C.dark } };
  obSheetRow.getCell('balance').numFmt = numFmt;
  if (openingBalance > 0) {
    obSheetRow.getCell('balance').font = { color: { argb: 'FF16A34A' } };
  } else if (openingBalance < 0) {
    obSheetRow.getCell('balance').font = { color: { argb: C.red } };
  }
  obSheetRow.alignment = { vertical: 'middle' };
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
    obSheetRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.grayBg } };
  });

  // Gap row
  sheet.addRow([]);

  // Column headers
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

  let totalPurchases = 0;
  let totalPaid = 0;
  let runningBalance = openingBalance;

  for (const row of rows) {
    runningBalance += (row.total_payment - row.paid_amount);
    const sheetRow = sheet.addRow({
      date: row.transaction_datetime,
      invoice: row.invoice_number || '-',
      desc: row.description || '-',
      qty: row.quantity ?? '-',
      rate: row.rate_per_unit ?? '-',
      total: row.total_payment,
      paid: row.paid_amount,
      balance: runningBalance,
    });

    totalPurchases += row.total_payment;
    totalPaid += row.paid_amount;

    sheetRow.font = { name: 'Inter', size: 10, color: { argb: C.dark } };
    sheetRow.getCell('rate').numFmt = numFmt;
    sheetRow.getCell('total').numFmt = numFmt;
    sheetRow.getCell('paid').numFmt = numFmt;
    sheetRow.getCell('balance').numFmt = numFmt;
    if (runningBalance > 0) {
      sheetRow.getCell('balance').font = { color: { argb: 'FF16A34A' } };
    } else if (runningBalance < 0) {
      sheetRow.getCell('balance').font = { color: { argb: C.red } };
    } else {
      sheetRow.getCell('balance').font = { color: { argb: 'FF808080' } };
    }
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
    balance: runningBalance,
  });

  totalsRow.font = { name: 'Inter', size: 11, bold: true, color: { argb: C.dark } };
  totalsRow.getCell('total').numFmt = numFmt;
  totalsRow.getCell('paid').numFmt = numFmt;
  totalsRow.getCell('balance').numFmt = numFmt;
  if (runningBalance > 0) {
    totalsRow.getCell('balance').font = { color: { argb: 'FF16A34A' } };
  } else if (runningBalance < 0) {
    totalsRow.getCell('balance').font = { color: { argb: C.red } };
  } else {
    totalsRow.getCell('balance').font = { color: { argb: 'FF808080' } };
  }
  totalsRow.alignment = { vertical: 'middle', horizontal: 'right' };
  totalsRow.getCell('date').alignment = { horizontal: 'left' };

  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
    totalsRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.bluePale } };
  });

  const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
  return { buffer, filePath };
}

/**
 * Insert a customer_ledger entry inside an existing transaction.
 * Does NOT open its own transaction — caller is responsible.
 */
export function insertCustomerLedgerEntryInTx(
  db: Database.Database,
  id: string,
  now: string,
  customerId: string,
  transactionDatetime: string,
  totalPayment: number,
  paidAmount: number,
  description?: string,
  transactionType: 'sale' | 'payment' = 'sale'
): void {
  const remainingBalance = totalPayment - paidAmount;
  db.prepare(`
    INSERT INTO customer_ledger (id, customer_id, transaction_datetime, description, vehicle_number,
      total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at, invoice_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, customerId, transactionDatetime, description ?? null, null,
    totalPayment, paidAmount, Math.abs(remainingBalance), transactionType, now, now, null);
}

/**
 * Creates a customer payment entry and optionally a linked vendor ledger entry
 * (e.g. when the business pays a mill on a customer's behalf).
 * Both entries are created in a single transaction with mutual linked_entry_id pointers.
 */
export function createCustomerPaymentWithVendorRef(
  customerId: string, transactionDatetime: string,
  amount: number, description: string, vendorId?: string,
  vendorDescription?: string
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const ledgerId = crypto.randomUUID();

  let vendorLedgerId: string | undefined

  if (vendorId) {
    const vendor = db.prepare('SELECT name FROM vendors WHERE id = ?').get(vendorId) as { name: string } | undefined;
    const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(customerId) as { name: string } | undefined;
    const vendorName = vendor?.name || '';
    const customerName = customer?.name || '';

    description = `Paid to mill directly (ref: @${vendorName})`;
    vendorDescription = `Received from customer (ref: @${customerName})`;
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO customer_ledger (id, customer_id, transaction_datetime, description, vehicle_number,
        total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at, invoice_id, linked_entry_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, customerId, transactionDatetime, description, null,
      0, amount, amount, 'payment', now, now, null, null);

    if (vendorId) {
      vendorLedgerId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO vendor_ledger (id, vendor_id, transaction_datetime, description, vehicle_number,
          total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at, vendor_invoice_id, linked_entry_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(vendorLedgerId, vendorId, transactionDatetime, vendorDescription ?? null, null,
        0, amount, amount, 'payment', now, now, null, ledgerId);

      db.prepare(`UPDATE customer_ledger SET linked_entry_id = ?, updated_at = ?, synced = 0 WHERE id = ?`)
        .run(vendorLedgerId, now, ledgerId);
    }
  });

  transaction();
  return getCustomerLedgerById(ledgerId);
}

export function createCustomerLedgerEntry(
  customerId: string,
  transactionDatetime: string,
  items: { productId: string; quantity: number; ratePerUnit: number }[],
  totalPayment: number,
  paidAmount: number,
  description?: string,
  vehicleNumber?: string,
  dueDate?: string,
  transactionType: 'sale' | 'payment' = 'sale'
) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const ledgerId = crypto.randomUUID();
  const remainingBalance = Math.abs(totalPayment - paidAmount);

  if (transactionType === 'payment') {
    db.prepare(`
      INSERT INTO customer_ledger (id, customer_id, transaction_datetime, description, vehicle_number,
        total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at, invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, customerId, transactionDatetime, description ?? null, null,
      0, paidAmount, paidAmount, 'payment', now, now, null);
    return getCustomerLedgerById(ledgerId);
  }

  // Sale entry: create invoice + items + deduct stock
  const invoiceId = crypto.randomUUID();
  const transaction = db.transaction(() => {
    const invoiceTotal = items.reduce((sum, it) => sum + (it.quantity * it.ratePerUnit), 0);
    const invoiceNumber = `INV-${Date.now()}`;
    const resolvedDueDate = dueDate || transactionDatetime.split('T')[0];

    db.prepare(`
      INSERT INTO invoices (id, customer_id, invoice_number, issue_date, due_date, subtotal, total, paid_amount, remaining_balance, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceId, customerId, invoiceNumber, transactionDatetime.split('T')[0], resolvedDueDate, invoiceTotal, invoiceTotal, paidAmount, invoiceTotal - paidAmount, (invoiceTotal - paidAmount) <= 0 ? 'Paid' : 'Pending', now, now);

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
      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, invoiceId, item.productId, item.quantity, item.ratePerUnit, item.quantity * item.ratePerUnit, now, now);
      const result = db.prepare(`UPDATE inventory SET quantity = quantity - ?, updated_at = ?, synced = 0 WHERE id = ?`)
        .run(item.quantity, now, item.productId);
      if (result.changes === 0) throw new Error('Product not found in inventory');
    }

    db.prepare(`
      INSERT INTO customer_ledger (id, customer_id, transaction_datetime, description, vehicle_number,
        total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at, invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ledgerId, customerId, transactionDatetime, description ?? null, vehicleNumber ?? null,
      totalPayment, paidAmount, remainingBalance, 'sale', now, now, invoiceId);
  });

  transaction();
  return getCustomerLedgerById(ledgerId);
}
