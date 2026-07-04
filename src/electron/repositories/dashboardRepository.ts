import { getDatabase } from '../database.js';

export function getDashboardStats() {
  const db = getDatabase();

  const vendorCount = (db.prepare('SELECT COUNT(*) as count FROM vendors WHERE deleted_at IS NULL').get() as { count: number }).count;
  const customerCount = (db.prepare('SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NULL').get() as { count: number }).count;
  const inventoryCount = (db.prepare('SELECT COUNT(*) as count FROM inventory WHERE deleted_at IS NULL').get() as { count: number }).count;
  const lowStockCount = (db.prepare('SELECT COUNT(*) as count FROM inventory WHERE deleted_at IS NULL AND quantity <= 10').get() as { count: number }).count;

  const today = new Date().toISOString().split('T')[0];

  const todaySales = (db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM customer_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${today}%`) as { total: number }).total;

  const todayPurchases = (db.prepare(`
    SELECT COALESCE(SUM(total_payment), 0) as total
    FROM vendor_ledger WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${today}%`) as { total: number }).total;

  const todayExpenses = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE deleted_at IS NULL AND transaction_datetime LIKE ?
  `).get(`${today}%`) as { total: number }).total;

  const recentTransactions = db.prepare(`
    SELECT 'Sale' as type, cl.transaction_datetime, c.name as party, cl.total_payment as amount
    FROM customer_ledger cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    WHERE cl.deleted_at IS NULL
    UNION ALL
    SELECT 'Purchase' as type, vl.transaction_datetime, v.name as party, vl.total_payment as amount
    FROM vendor_ledger vl
    LEFT JOIN vendors v ON v.id = vl.vendor_id
    WHERE vl.deleted_at IS NULL
    ORDER BY transaction_datetime DESC
    LIMIT 10
  `).all() as { type: string; transaction_datetime: string; party: string; amount: number }[];

  const lowStockItems = db.prepare(`
    SELECT * FROM inventory WHERE deleted_at IS NULL AND quantity <= 10 ORDER BY quantity ASC LIMIT 10
  `).all() as { id: string; name: string; unit: string; quantity: number; description: string | null }[];

  return {
    vendorCount,
    customerCount,
    inventoryCount,
    lowStockCount,
    todaySales,
    todayPurchases,
    todayExpenses,
    recentTransactions,
    lowStockItems,
  };
}
