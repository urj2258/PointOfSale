import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { app } from 'electron';
import { initDatabase, getDatabase, closeDatabase } from './database.js';
import crypto from 'crypto';

app.setName('pos');
app.setPath('userData', 'D:\\pos-data');
initDatabase();
const db = getDatabase();

// Clear all tables (FK-safe order: children before parents)
const clearAll = db.transaction(() => {
  db.prepare('DELETE FROM customer_ledger').run();
  db.prepare('DELETE FROM invoice_items').run();
  db.prepare('DELETE FROM invoices').run();
  db.prepare('DELETE FROM vendor_invoice_items').run();
  db.prepare('DELETE FROM vendor_invoices').run();
  db.prepare('DELETE FROM vendor_ledger').run();
  db.prepare('DELETE FROM expenses').run();
  db.prepare('DELETE FROM day_closing_reports').run();
  db.prepare('DELETE FROM inventory').run();
  db.prepare('DELETE FROM expense_categories').run();
  db.prepare('DELETE FROM customers').run();
  db.prepare('DELETE FROM vendors').run();
  db.prepare('DELETE FROM users').run();
});
clearAll();

// Re-seed default expense categories and owner
const seedDefaults = db.transaction(() => {
  const cats = [
    'Electricity Bill', 'Travelling Expense', 'Employee Salary',
    'Daily Wages', 'Vehicle Expenses', 'Office Rent', 'Miscellaneous Expenses',
  ];
  const now = new Date().toISOString();
  const insertCat = db.prepare(`INSERT INTO expense_categories (id, name, created_at, updated_at, synced, deleted_at)
    VALUES (?, ?, ?, ?, 0, NULL)`);
  for (const name of cats) {
    insertCat.run(crypto.randomUUID(), name, now, now);
  }

  const email = process.env.OWNER_EMAIL || 'owner@gmail.com';
  const password = process.env.OWNER_PASSWORD || 'owner123';
  const fullName = process.env.OWNER_NAME || 'Owner';
  const username = process.env.OWNER_USERNAME || 'owner';
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO users (id, full_name, email, username, password, created_at, updated_at, synced, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`).run(crypto.randomUUID(), fullName, email, username, hashedPassword, now, now);
});
seedDefaults();

const now = new Date().toISOString();
const earlier = new Date(Date.now() - 86400000).toISOString();

function id() {
  return crypto.randomUUID();
}

// ── vendors ──────────────────────────────────────────────
const vendor1 = id(), vendor2 = id();
db.prepare(`INSERT INTO vendors (id, name, phone, address, mill_name, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vendor1, 'Shahzeb Mills', '03001234567', 'Lahore', 'Shahzeb Steel', earlier, earlier, 0);
db.prepare(`INSERT INTO vendors (id, name, phone, address, mill_name, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vendor2, 'Al-Rahim Traders', '03009876543', 'Karachi', 'Al-Rahim Iron', now, now, 0);

// ── customers ────────────────────────────────────────────
const cust1 = id(), cust2 = id();
db.prepare(`INSERT INTO customers (id, name, phone, address, shop_name, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(cust1, 'Bismillah Hardware', '03211234567', 'Gujranwala', 'Bismillah Store', earlier, earlier, 0);
db.prepare(`INSERT INTO customers (id, name, phone, address, shop_name, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(cust2, 'New City Builders', '03119876543', 'Islamabad', 'New City Construction', now, now, 0);

// ── inventory ────────────────────────────────────────────
const prod1 = id(), prod2 = id(), prod3 = id();
db.prepare(`INSERT INTO inventory (id, name, unit, quantity, description, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(prod1, 'Steel Rod 12mm', 'kg', 500, 'Grade 60', earlier, earlier, 0);
db.prepare(`INSERT INTO inventory (id, name, unit, quantity, description, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(prod2, 'Cement Portland', 'bag', 200, 'Best Quality', now, now, 0);
db.prepare(`INSERT INTO inventory (id, name, unit, quantity, description, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(prod3, 'Sand', 'ton', 0, 'Out of stock', now, now, 0);

// ── expense_categories ───────────────────────────────────
const ecat1 = id(), ecat2 = id();
db.prepare(`INSERT INTO expense_categories (id, name, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, NULL)`).run(ecat1, 'Fuel', earlier, earlier, 0);
db.prepare(`INSERT INTO expense_categories (id, name, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, NULL)`).run(ecat2, 'Office Supplies', now, now, 0);

// ── vendor_ledger ────────────────────────────────────────
const vl1 = id(), vl2 = id();
db.prepare(`INSERT INTO vendor_ledger (id, vendor_id, product_id, transaction_datetime, description, vehicle_number, quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vl1, vendor1, prod1, earlier, 'Initial stock', 'LHR-1234', 100, 120, 12000, 12000, 0, earlier, earlier, 0);
db.prepare(`INSERT INTO vendor_ledger (id, vendor_id, product_id, transaction_datetime, description, vehicle_number, quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vl2, vendor2, prod2, now, 'Cement supply', 'KHI-5678', 50, 1050, 52500, 30000, 22500, now, now, 0);

// ── vendor_invoices ─────────────────────────────────────
const vi1 = id(), vi2 = id();
db.prepare(`INSERT INTO vendor_invoices (id, vendor_id, invoice_number, issue_date, due_date,
  subtotal, tax_amount, discount_amount, total, paid_amount, remaining_balance,
  status, notes, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vi1, vendor1, 'P-INV-2026-001', '2026-07-07', '2026-07-21', 11500, 1150, 0, 12650, 12650, 0, 'Paid', 'Full payment', earlier, earlier, 0);
db.prepare(`INSERT INTO vendor_invoices (id, vendor_id, invoice_number, issue_date, due_date,
  subtotal, tax_amount, discount_amount, total, paid_amount, remaining_balance,
  status, notes, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vi2, vendor2, 'P-INV-2026-002', '2026-07-08', '2026-08-07', 50000, 5000, 2500, 52500, 30000, 22500, 'Pending', 'Partial payment', now, now, 0);

// ── customer_ledger ──────────────────────────────────────
const cl1 = id(), cl2 = id();
db.prepare(`INSERT INTO customer_ledger (id, customer_id, product_id, transaction_datetime, description, vehicle_number, quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(cl1, cust1, prod1, earlier, 'Sold rods', 'GUJ-9012', 30, 150, 4500, 4500, 0, earlier, earlier, 0);
db.prepare(`INSERT INTO customer_ledger (id, customer_id, product_id, transaction_datetime, description, vehicle_number, quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(cl2, cust2, prod2, now, 'Sold cement', 'ISL-3456', 20, 1300, 26000, 10000, 16000, now, now, 0);

// ── invoices ──────────────────────────────────────────────
const inv1 = id(), inv2 = id();
db.prepare(`INSERT INTO invoices (id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax_amount, discount_amount, total, paid_amount, remaining_balance,
  status, notes, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(inv1, cust1, 'INV-2026-001', '2026-07-07', '2026-07-21', 4000, 400, 0, 4400, 4400, 0, 'Paid', 'Full payment received', earlier, earlier, 0);
db.prepare(`INSERT INTO invoices (id, customer_id, invoice_number, issue_date, due_date,
  subtotal, tax_amount, discount_amount, total, paid_amount, remaining_balance,
  status, notes, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(inv2, cust2, 'INV-2026-002', '2026-07-08', '2026-08-07', 25000, 2500, 1000, 26500, 10000, 16500, 'Pending', 'Partial payment', now, now, 0);

// ── invoice_items ─────────────────────────────────────────
const ii1 = id(), ii2 = id(), ii3 = id();
db.prepare(`INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(ii1, inv1, prod1, 20, 200, 4000, earlier, earlier, 0);
db.prepare(`INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(ii2, inv2, prod2, 15, 1600, 24000, now, now, 0);
db.prepare(`INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(ii3, inv2, prod1, 10, 100, 1000, now, now, 0);

// ── vendor_invoice_items ──────────────────────────────────
const vii1 = id(), vii2 = id();
db.prepare(`INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vii1, vi1, prod1, 80, 143.75, 11500, earlier, earlier, 0);
db.prepare(`INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(vii2, vi2, prod2, 40, 1250, 50000, now, now, 0);

// ── expenses ─────────────────────────────────────────────
const exp1 = id(), exp2 = id();
db.prepare(`INSERT INTO expenses (id, category_id, transaction_datetime, amount, description, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(exp1, ecat1, earlier, 5000, 'Diesel for delivery truck', earlier, earlier, 0);
db.prepare(`INSERT INTO expenses (id, category_id, transaction_datetime, amount, description, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(exp2, ecat2, now, 1500, 'Printer paper', now, now, 0);

// ── day_closing_reports ──────────────────────────────────
db.prepare(`INSERT INTO day_closing_reports (id, business_date, total_sales, total_purchases, total_expenses, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(id(), '2026-07-07', 4500, 12000, 5000, earlier, earlier, 0);
db.prepare(`INSERT INTO day_closing_reports (id, business_date, total_sales, total_purchases, total_expenses, created_at, updated_at, synced, deleted_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`).run(id(), '2026-07-08', 26000, 52500, 1500, now, now, 0);

console.log('Test data seeded.');
console.log('  vendors   : 2 (all unsynced)');
console.log('  customers : 2 (all unsynced)');
console.log('  inventory : 3 (all unsynced)');
console.log('  exp_cats  : 2 (all unsynced)');
console.log('  v_ledger  : 2 (all unsynced)');
console.log('  v_invoices: 2 (all unsynced)');
console.log('  c_ledger  : 2 (all unsynced)');
console.log('  invoices  : 2 (all unsynced)');
console.log('  invoice_items  : 3 (all unsynced)');
console.log('  v_invoice_items: 2 (all unsynced)');
console.log('  expenses  : 2 (all unsynced)');
console.log('  day_close : 2 (all unsynced)');
console.log('  users     : 1 (already seeded via seed:owner)');
console.log('');
console.log('Now run the app and click Settings > Sync Now to push all rows to Turso.');

closeDatabase();
process.exit(0);
