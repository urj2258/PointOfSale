import { getDatabase } from '../database.js';

export type DashboardPeriod = 'day' | 'month' | 'year' | 'custom';

function computeDateRange(
  period: DashboardPeriod,
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const today = new Date().toISOString().split('T')[0];

  switch (period) {
    case 'day':
      return { start: today, end: today };
    case 'month': {
      const now = new Date();
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: firstOfMonth, end: today };
    }
    case 'year': {
      const year = new Date().getFullYear();
      return { start: `${year}-01-01`, end: today };
    }
    case 'custom':
      return { start: startDate || today, end: endDate || today };
    default:
      return { start: today, end: today };
  }
}

export function getDashboardStats(
  lowStockThreshold = 10,
  period: DashboardPeriod = 'day',
  startDate?: string,
  endDate?: string
) {
  const db = getDatabase();

  // ── Static counts (not date-filtered) ──────────────────────────────────────
  const vendorCount = (db.prepare('SELECT COUNT(*) as count FROM vendors WHERE deleted_at IS NULL').get() as { count: number }).count;
  const customerCount = (db.prepare('SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL').get() as { count: number }).count;
  const inventoryCount = (db.prepare('SELECT COUNT(*) as count FROM inventory WHERE deleted_at IS NULL').get() as { count: number }).count;
  const lowStockCount = (db.prepare('SELECT COUNT(*) as count FROM inventory WHERE deleted_at IS NULL AND quantity <= ?').get(lowStockThreshold) as { count: number }).count;

  const pendingInvoices = (db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL AND status = 'Pending'`).get() as { count: number }).count;
  const overdueInvoices = (db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL AND status = 'Overdue'`).get() as { count: number }).count;
  const pendingVendorInvoices = (db.prepare(`SELECT COUNT(*) as count FROM vendor_invoices WHERE deleted_at IS NULL AND status = 'Pending'`).get() as { count: number }).count;
  const overdueVendorInvoices = (db.prepare(`SELECT COUNT(*) as count FROM vendor_invoices WHERE deleted_at IS NULL AND status = 'Overdue'`).get() as { count: number }).count;

  const lowStockItems = db.prepare(`
    SELECT * FROM inventory WHERE deleted_at IS NULL AND quantity <= ? ORDER BY quantity ASC LIMIT 10
  `).all(lowStockThreshold) as { id: string; name: string; unit: string; quantity: number; description: string | null }[];

  // ── Date-filtered stats ─────────────────────────────────────────────────────
  const { start, end } = computeDateRange(period, startDate, endDate);

  // customer_ledger / vendor_ledger use transaction_datetime (datetime string)
  // expenses uses transaction_datetime
  // invoices / vendor_invoices use issue_date (date string)
  const dtStart = `${start}T00:00:00`;
  const dtEnd   = `${end}T23:59:59`;

  const todaySales = (db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM customer_ledger
    WHERE deleted_at IS NULL
      AND transaction_datetime >= ?
      AND transaction_datetime <= ?
  `).get(dtStart, dtEnd) as { total: number }).total;

  const todayPurchases = (db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM vendor_ledger
    WHERE deleted_at IS NULL
      AND transaction_datetime >= ?
      AND transaction_datetime <= ?
  `).get(dtStart, dtEnd) as { total: number }).total;

  const todayExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE deleted_at IS NULL
      AND transaction_datetime >= ?
      AND transaction_datetime <= ?
  `).get(dtStart, dtEnd) as { total: number }).total;

  const todayInvoiceSales = (db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM invoices
    WHERE deleted_at IS NULL
      AND issue_date >= ?
      AND issue_date <= ?
  `).get(start, end) as { total: number }).total;

  const todayVendorInvoicePurchases = (db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM vendor_invoices
    WHERE deleted_at IS NULL
      AND issue_date >= ?
      AND issue_date <= ?
  `).get(start, end) as { total: number }).total;

  const recentTransactions = db.prepare(`
    SELECT 'Sale' as type, cl.transaction_datetime, c.name as party, cl.total_payment as amount
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    WHERE cl.deleted_at IS NULL
      AND cl.transaction_datetime >= ?
      AND cl.transaction_datetime <= ?
    UNION ALL
    SELECT 'Purchase' as type, vl.transaction_datetime, v.name as party, vl.total_payment as amount
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    WHERE vl.deleted_at IS NULL
      AND vl.transaction_datetime >= ?
      AND vl.transaction_datetime <= ?
    ORDER BY transaction_datetime DESC
    LIMIT 10
  `).all(dtStart, dtEnd, dtStart, dtEnd) as { type: string; transaction_datetime: string; party: string; amount: number }[];

  return {
    vendorCount,
    customerCount,
    inventoryCount,
    lowStockCount,
    todaySales,
    todayPurchases,
    todayExpenses,
    todayInvoiceSales,
    todayVendorInvoicePurchases,
    pendingInvoices,
    overdueInvoices,
    pendingVendorInvoices,
    overdueVendorInvoices,
    recentTransactions,
    lowStockItems,
    // expose the resolved range so the frontend can display it
    periodStart: start,
    periodEnd: end,
  };
}
