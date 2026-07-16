import { getDatabase } from '../database.js';
import { app } from 'electron';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

export interface DayClosingRow {
  id: string
  business_date: string
  total_sales: number
  total_purchases: number
  total_expenses: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

const EXPORT_FILE = 'DayClosing_Report.xlsx';
// Separate file for the summary export so it never overwrites the detailed report
const SUMMARY_FILE = 'DayClosing_Summary.xlsx';
const CONFIG_FILE = 'export-config.json';

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

export function getExportDir(): string | null {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    const cfg = JSON.parse(raw) as { exportDir?: string };
    return cfg.exportDir || null;
  } catch {
    return null;
  }
}

export function setExportDir(dir: string) {
  fs.writeFileSync(getConfigPath(), JSON.stringify({ exportDir: dir }));
}

export function getExportPath(): string | null {
  const dir = getExportDir();
  return dir ? path.join(dir, EXPORT_FILE) : null;
}

export function getSummaryExportPath(fromDate?: string, toDate?: string): string | null {
  const dir = getExportDir();
  if (!dir) return null;

  if (fromDate && toDate) {
    const safeFrom = fromDate.replace(/[^0-9-]/g, '');
    const safeTo = toDate.replace(/[^0-9-]/g, '');
    return path.join(dir, `DayClosing_Summary_${safeFrom}_to_${safeTo}.xlsx`);
  }

  return path.join(dir, SUMMARY_FILE);
}

export function getDayClosings(page = 1, limit = 20) {
  const db = getDatabase();
  const offset = (page - 1) * limit;
  const countRow = db.prepare('SELECT COUNT(*) as total FROM day_closing_reports').get() as { total: number };
  const data = db.prepare('SELECT * FROM day_closing_reports ORDER BY business_date DESC LIMIT ? OFFSET ?').all(limit, offset) as DayClosingRow[];
  return { data, total: countRow.total, page, limit };
}

export function getDayClosingByDate(date: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM day_closing_reports WHERE business_date = ?').get(date) as DayClosingRow | undefined;
}

export function generateDayClosing(businessDate: string): { report: DayClosingRow; updated: boolean } {
  const db = getDatabase();
  const now = new Date().toISOString();

  const salesRow = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM customer_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${businessDate}%`) as { total: number };

  const purchasesRow = db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM vendor_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${businessDate}%`) as { total: number };

  const expensesRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${businessDate}%`) as { total: number };

  const existing = db.prepare('SELECT id FROM day_closing_reports WHERE business_date = ?').get(businessDate) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE day_closing_reports SET total_sales = ?, total_purchases = ?, total_expenses = ?, updated_at = ?, synced = 0
      WHERE business_date = ?
    `).run(salesRow.total, purchasesRow.total, expensesRow.total, now, businessDate);
  } else {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO day_closing_reports (id, business_date, total_sales, total_purchases, total_expenses, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, businessDate, salesRow.total, purchasesRow.total, expensesRow.total, now, now);
  }

  return { report: getDayClosingByDate(businessDate)!, updated: !!existing };
}

function fmtDate(businessDate: string): string {
  const d = new Date(businessDate + 'T00:00:00');
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()}-${m[d.getMonth()]}-${d.getFullYear()}`;
}

const C = {
  dark: 'FF111827', blue: 'FF2563EB', bluePale: 'FFDBEAFE',
  green: 'FF059669', red: 'FFDC2626',
  greenBg: 'FFD1FAE5', redBg: 'FFFEE2E2', grayBg: 'FFF9FAFB',
  border: 'FFE5E7EB', white: 'FFFFFFFF', muted: 'FF6B7280',
};

export async function exportDayClosingExcel(businessDate: string): Promise<{ buffer: Buffer; filePath: string }> {
  const db = getDatabase();

  const sales = db.prepare(`
    SELECT cl.transaction_datetime, cl.total_payment, cl.paid_amount, cl.remaining_balance,
           c.name as customer_name
    FROM customer_ledger cl LEFT JOIN customers c ON c.id = cl.customer_id
    WHERE cl.deleted_at IS NULL AND cl.transaction_datetime LIKE ?
    ORDER BY cl.transaction_datetime ASC
  `).all(`${businessDate}%`) as { transaction_datetime: string; total_payment: number; paid_amount: number; remaining_balance: number; customer_name: string }[];

  const purchases = db.prepare(`
    SELECT vl.transaction_datetime, vl.total_payment, vl.paid_amount, vl.remaining_balance,
           v.name as vendor_name
    FROM vendor_ledger vl LEFT JOIN vendors v ON v.id = vl.vendor_id
    WHERE vl.deleted_at IS NULL AND vl.transaction_datetime LIKE ?
    ORDER BY vl.transaction_datetime ASC
  `).all(`${businessDate}%`) as { transaction_datetime: string; total_payment: number; paid_amount: number; remaining_balance: number; vendor_name: string }[];

  const expenses = db.prepare(`
    SELECT e.transaction_datetime, e.amount, e.description, ec.name as category_name
    FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.deleted_at IS NULL AND e.transaction_datetime LIKE ?
    ORDER BY e.transaction_datetime ASC
  `).all(`${businessDate}%`) as { transaction_datetime: string; amount: number; description: string | null; category_name: string }[];

  const totalSales = sales.reduce((s, r) => s + r.total_payment, 0);
  const totalPurchases = purchases.reduce((s, r) => s + r.total_payment, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
  const netProfit = totalSales - totalPurchases - totalExpenses;

  const filePath = getExportPath()!;
  let workbook: ExcelJS.Workbook;
  if (fs.existsSync(filePath)) {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const old = workbook.getWorksheet(fmtDate(businessDate));
    if (old) workbook.removeWorksheet(old.id);
  } else {
    workbook = new ExcelJS.Workbook();
    workbook.creator = 'POS System';
    workbook.created = new Date();
  }

  const ws = workbook.addWorksheet(fmtDate(businessDate), { properties: { tabColor: { argb: C.blue } } });
  ws.columns = [
    { width: 3 }, { width: 22 }, { width: 22 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  const bdr: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: C.border } },
    bottom: { style: 'thin', color: { argb: C.border } },
    left: { style: 'thin', color: { argb: C.border } },
    right: { style: 'thin', color: { argb: C.border } },
  };

  const fillBg = (color: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });
  const fillRow = (r: number, color: string, cols = 7) => { for (let c = 1; c <= cols; c++) ws.getCell(r, c).fill = fillBg(color); };

  let row = 1;

  // ── Title banner ──
  ws.mergeCells(row, 1, row, 7);
  ws.getCell(row, 1).value = 'Day Closing Report';
  ws.getCell(row, 1).font = { bold: true, size: 18, color: { argb: C.white } };
  ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 42;
  fillRow(row, C.dark);
  row++;

  ws.mergeCells(row, 1, row, 7);
  ws.getCell(row, 1).value = fmtDate(businessDate);
  ws.getCell(row, 1).font = { bold: true, size: 13, color: { argb: C.white } };
  ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 28;
  fillRow(row, C.blue);
  row += 2;

  // ── Summary cards ──
  const cards = [
    { label: 'Total Sales', value: totalSales, fg: C.green, bg: C.greenBg },
    { label: 'Total Purchases', value: totalPurchases, fg: C.red, bg: C.redBg },
    { label: 'Total Expenses', value: totalExpenses, fg: C.red, bg: C.redBg },
    { label: 'Net Profit', value: netProfit, fg: netProfit >= 0 ? C.green : C.red, bg: netProfit >= 0 ? C.greenBg : C.redBg },
  ];
  for (const card of cards) {
    ws.mergeCells(row, 2, row, 3);
    const lbl = ws.getCell(row, 2);
    lbl.value = card.label;
    lbl.font = { bold: true, size: 11, color: { argb: C.muted } };
    lbl.alignment = { vertical: 'middle' };
    lbl.border = bdr;
    ws.mergeCells(row, 4, row, 5);
    const val = ws.getCell(row, 4);
    val.value = card.value;
    val.numFmt = '"Rs. "#,##0';
    val.font = { bold: true, size: 13, color: { argb: card.fg } };
    val.alignment = { horizontal: 'right', vertical: 'middle' };
    val.border = bdr;
    ws.getRow(row).height = 28;
    fillRow(row, card.bg);
    row++;
  }
  row++;

  // ── Helper: section header ──
  function addSectionHeader(label: string, count: number) {
    ws.mergeCells(row, 1, row, 7);
    const cell = ws.getCell(row, 1);
    cell.value = `${label}  (${count} transaction${count !== 1 ? 's' : ''})`;
    cell.font = { bold: true, size: 12, color: { argb: C.white } };
    cell.alignment = { vertical: 'middle' };
    ws.getRow(row).height = 26;
    fillRow(row, C.dark);
    row++;
  }

  // ── Helper: table header ──
  function addTableHeader(cols: string[]) {
    cols.forEach((h, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = h;
      cell.font = { bold: true, size: 10, color: { argb: C.muted } };
      cell.fill = fillBg(C.grayBg);
      cell.border = bdr;
      cell.alignment = { vertical: 'middle' };
    });
    ws.getRow(row).height = 22;
    row++;
  }

  // ── Helper: totals row ──
  function addTotalsRow(labels: (string | number)[]) {
    labels.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.font = { bold: true, size: 11 };
      cell.border = bdr;
      cell.fill = fillBg(C.bluePale);
      if (i >= 2) cell.numFmt = '"Rs. "#,##0';
    });
    ws.getRow(row).height = 24;
    row++;
  }

  // ── Sales ──
  addSectionHeader('SALES', sales.length);
  addTableHeader(['Time', 'Customer', 'Total', 'Paid', 'Remaining']);
  for (const s of sales) {
    const vals = [s.transaction_datetime.replace('T', ' '), s.customer_name, s.total_payment, s.paid_amount, s.remaining_balance];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.border = bdr;
      if (i >= 2) cell.numFmt = '"Rs. "#,##0';
    });
    row++;
  }
  if (sales.length > 0) {
    addTotalsRow(['', 'TOTAL', totalSales, sales.reduce((s, r) => s + r.paid_amount, 0), sales.reduce((s, r) => s + r.remaining_balance, 0)]);
  }
  row++;

  // ── Purchases ──
  addSectionHeader('PURCHASES', purchases.length);
  addTableHeader(['Time', 'Vendor', 'Total', 'Paid', 'Remaining']);
  for (const p of purchases) {
    const vals = [p.transaction_datetime.replace('T', ' '), p.vendor_name, p.total_payment, p.paid_amount, p.remaining_balance];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.border = bdr;
      if (i >= 2) cell.numFmt = '"Rs. "#,##0';
    });
    row++;
  }
  if (purchases.length > 0) {
    addTotalsRow(['', 'TOTAL', totalPurchases, purchases.reduce((s, r) => s + r.paid_amount, 0), purchases.reduce((s, r) => s + r.remaining_balance, 0)]);
  }
  row++;

  // ── Expenses ──
  addSectionHeader('EXPENSES', expenses.length);
  addTableHeader(['Time', 'Category', 'Description', 'Amount']);
  for (const e of expenses) {
    const vals = [e.transaction_datetime.replace('T', ' '), e.category_name, e.description || '', e.amount];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.border = bdr;
      if (i === 3) cell.numFmt = '"Rs. "#,##0';
    });
    row++;
  }
  if (expenses.length > 0) {
    addTotalsRow(['', 'TOTAL', '', totalExpenses]);
  }

  const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
  return { buffer, filePath };
}

/**
 * Build a summary workbook: one row per day_closing_reports entry.
 * fromDate / toDate are ISO date strings that filter on created_at.
 * When both are omitted the entire table is exported.
 */
export async function exportDayClosingSummaryExcel(
  fromDate?: string,
  toDate?: string,
): Promise<{ buffer: Buffer; filePath: string }> {
  const db = getDatabase();

  // Build the WHERE clause depending on which dates were supplied
  let rows: DayClosingRow[];
  if (fromDate && toDate) {
    rows = db.prepare(
      `SELECT * FROM day_closing_reports
       WHERE business_date >= ? AND business_date <= ?
       ORDER BY business_date DESC`,
    ).all(fromDate, toDate) as DayClosingRow[];
  } else if (fromDate) {
    rows = db.prepare(
      `SELECT * FROM day_closing_reports
       WHERE business_date >= ?
       ORDER BY business_date DESC`,
    ).all(fromDate) as DayClosingRow[];
  } else if (toDate) {
    rows = db.prepare(
      `SELECT * FROM day_closing_reports
       WHERE business_date <= ?
       ORDER BY business_date DESC`,
    ).all(toDate) as DayClosingRow[];
  } else {
    // No filter — full table export
    rows = db.prepare(
      `SELECT * FROM day_closing_reports ORDER BY business_date DESC`,
    ).all() as DayClosingRow[];
  }

  if (rows.length === 0) {
    throw new Error('Invalid range! No records found for the selected dates.');
  }

  const filePath = getSummaryExportPath(fromDate, toDate)!;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Day Closing Summary', {
    properties: { tabColor: { argb: C.blue } },
  });

  // Column widths to match the 7-column layout used in the detailed report
  ws.columns = [
    { width: 3 },   // gutter
    { width: 18 },  // Business Date
    { width: 24 },  // Created At
    { width: 24 },  // Updated At
    { width: 18 },  // Total Sales
    { width: 18 },  // Total Purchases
    { width: 18 },  // Total Expenses
    { width: 18 },  // Net Profit
  ];

  const bdr: Partial<ExcelJS.Borders> = {
    top:    { style: 'thin', color: { argb: C.border } },
    bottom: { style: 'thin', color: { argb: C.border } },
    left:   { style: 'thin', color: { argb: C.border } },
    right:  { style: 'thin', color: { argb: C.border } },
  };

  const fillBg = (color: string): ExcelJS.Fill =>
    ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });

  const fillRow = (r: number, color: string, cols = 8) => {
    for (let c = 1; c <= cols; c++) ws.getCell(r, c).fill = fillBg(color);
  };

  let row = 1;

  // ── Title banner (matches the existing detailed report style) ──
  ws.mergeCells(row, 1, row, 8);
  ws.getCell(row, 1).value = 'Day Closing Summary Report';
  ws.getCell(row, 1).font = { bold: true, size: 18, color: { argb: C.white } };
  ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 42;
  fillRow(row, C.dark);
  row++;

  // Sub-title: show the date range that was applied, or "All Records"
  const rangeLabel =
    fromDate && toDate ? `${fromDate}  →  ${toDate}`
    : fromDate         ? `From ${fromDate}`
    : toDate           ? `Up to ${toDate}`
    :                    'All Records';
  ws.mergeCells(row, 1, row, 8);
  ws.getCell(row, 1).value = rangeLabel;
  ws.getCell(row, 1).font = { bold: true, size: 13, color: { argb: C.white } };
  ws.getCell(row, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(row).height = 28;
  fillRow(row, C.blue);
  row += 2;

  // ── Column header row ──
  const headers = [
    'Business Date', 'Created At', 'Updated At',
    'Total Sales', 'Total Purchases', 'Total Expenses', 'Net Profit',
  ];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 2);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: C.muted } };
    cell.fill = fillBg(C.grayBg);
    cell.border = bdr;
    cell.alignment = { vertical: 'middle' };
  });
  ws.getRow(row).height = 22;
  row++;

  // ── Data rows ──
  let grandSales = 0;
  let grandPurchases = 0;
  let grandExpenses = 0;

  for (const r of rows) {
    const net = r.total_sales - r.total_purchases - r.total_expenses;
    grandSales      += r.total_sales;
    grandPurchases  += r.total_purchases;
    grandExpenses   += r.total_expenses;

    const values = [
      r.business_date,
      r.created_at.replace('T', ' '),
      r.updated_at.replace('T', ' '),
      r.total_sales,
      r.total_purchases,
      r.total_expenses,
      net,
    ];

    values.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.border = bdr;
      // Columns 4-7 (i = 3..6) are currency values
      if (i >= 3) cell.numFmt = '"Rs. "#,##0';
      // Colour-code the Net Profit cell green/red
      if (i === 6) {
        cell.font = { bold: true, color: { argb: (v as number) >= 0 ? C.green : C.red } };
      }
    });
    row++;
  }

  // ── Totals row ──
  if (rows.length > 0) {
    const grandNet = grandSales - grandPurchases - grandExpenses;
    const totals = ['', 'TOTAL', '', grandSales, grandPurchases, grandExpenses, grandNet];
    totals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 2);
      cell.value = v;
      cell.font = { bold: true, size: 11 };
      cell.border = bdr;
      cell.fill = fillBg(C.bluePale);
      if (i >= 3) cell.numFmt = '"Rs. "#,##0';
    });
    ws.getRow(row).height = 24;
  }

  const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
  return { buffer, filePath };
}
