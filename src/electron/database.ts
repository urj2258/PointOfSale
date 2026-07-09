import { config } from 'dotenv';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { app } from 'electron';
import { isAllowedEmailDomain } from './validation.js';

function loadEnv(): void {
  if (app.isPackaged) {
    config({ path: path.join(process.resourcesPath, '.env') });
  } else {
    config();
  }
}

let db: Database.Database | null = null;

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'pos.db');
}

export function initDatabase(): Database.Database {
  if (db) return db;
  loadEnv();

  const dbPath = getDbPath();
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);
  migrateSchema(db);
  createIndexes(db);
  seedExpenseCategories(db);
  seedOwner(db);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Order in which tables must be synced to the cloud to respect FK dependencies.
 * 1. Independent tables (no FK dependencies)
 * 2. Tables that depend on step 1
 * 3. Safety net — sync last
 */
export const SYNC_TABLE_ORDER: string[] = [
  'vendors',
  'customers',
  'inventory',
  'expense_categories',
  'vendor_ledger',
  'vendor_invoices',
  'vendor_invoice_items',
  'customer_ledger',
  'invoices',
  'invoice_items',
  'expenses',
  'day_closing_reports',
  'users',
];

function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      mill_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      shop_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      quantity REAL NOT NULL CHECK (quantity >= 0),
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vendor_ledger (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      transaction_datetime TEXT NOT NULL,
      description TEXT,
      vehicle_number TEXT,
      quantity REAL NOT NULL CHECK (quantity > 0),
      rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
      total_payment REAL NOT NULL CHECK (total_payment >= 0),
      paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
      remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (product_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_invoices (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL CHECK (total >= 0),
      paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      remaining_balance REAL NOT NULL DEFAULT 0 CHECK (remaining_balance >= 0),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS vendor_invoice_items (
      id TEXT PRIMARY KEY,
      vendor_invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL CHECK (quantity > 0),
      rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
      total REAL NOT NULL CHECK (total >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id),
      FOREIGN KEY (product_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS customer_ledger (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      transaction_datetime TEXT NOT NULL,
      description TEXT,
      vehicle_number TEXT,
      quantity REAL NOT NULL CHECK (quantity > 0),
      rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
      total_payment REAL NOT NULL CHECK (total_payment >= 0),
      paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
      remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      transaction_datetime TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL CHECK (total >= 0),
      paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      remaining_balance REAL NOT NULL DEFAULT 0 CHECK (remaining_balance >= 0),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL CHECK (quantity > 0),
      rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
      total REAL NOT NULL CHECK (total >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (product_id) REFERENCES inventory(id)
    );

    CREATE TABLE IF NOT EXISTS day_closing_reports (
      id TEXT PRIMARY KEY,
      business_date TEXT NOT NULL UNIQUE,
      total_sales REAL NOT NULL DEFAULT 0,
      total_purchases REAL NOT NULL DEFAULT 0,
      total_expenses REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function migrateSchema(db: Database.Database): void {
  function addColumn(table: string, columnDef: string) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch {
      // Column already exists
    }
  }

  const tableCols = (table: string): string[] =>
    (db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all() as { name: string }[]).map(c => c.name);

  const dcrCols = tableCols('day_closing_reports');
  if (dcrCols.includes('delted_at') && !dcrCols.includes('deleted_at')) {
    db.exec('ALTER TABLE day_closing_reports RENAME COLUMN delted_at TO deleted_at');
  } else if (!dcrCols.includes('deleted_at')) {
    addColumn('day_closing_reports', 'deleted_at TEXT NULL');
  }
  if (!dcrCols.includes('updated_at')) {
    addColumn('day_closing_reports', 'updated_at TEXT NOT NULL DEFAULT \'\'');
  }
  if (!dcrCols.includes('synced')) {
    addColumn('day_closing_reports', 'synced INTEGER NOT NULL DEFAULT 0');
  }

  const userCols = tableCols('users');
  if (!userCols.includes('deleted_at')) {
    addColumn('users', 'deleted_at TEXT NULL');
  }
  if (!userCols.includes('synced')) {
    addColumn('users', 'synced INTEGER NOT NULL DEFAULT 0');
  }

  const expenseCols = tableCols('expenses');
  if (expenseCols.includes('sycned') && !expenseCols.includes('synced')) {
    db.exec('ALTER TABLE expenses RENAME COLUMN sycned TO synced');
  }
}

function createIndexes(db: Database.Database): void {
  const syncedTables = [
    'vendors', 'customers', 'inventory',
    'vendor_ledger', 'vendor_invoices', 'vendor_invoice_items',
    'customer_ledger', 'invoices', 'invoice_items',
    'expense_categories', 'expenses',
    'day_closing_reports', 'users',
  ];
  for (const table of syncedTables) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_synced ON ${table}(synced)`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON vendors(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at ON inventory(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_id ON vendor_ledger(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_product_id ON vendor_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_transaction_datetime ON vendor_ledger(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_deleted_at ON vendor_ledger(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor_id ON vendor_invoices(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_issue_date ON vendor_invoices(issue_date);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_due_date ON vendor_invoices(due_date);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status ON vendor_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_deleted_at ON vendor_invoices(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_product_id ON customer_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_transaction_datetime ON customer_ledger(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_deleted_at ON customer_ledger(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_deleted_at ON invoices(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_deleted_at ON invoice_items(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_vendor_invoice_items_vendor_invoice_id ON vendor_invoice_items(vendor_invoice_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoice_items_product_id ON vendor_invoice_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoice_items_deleted_at ON vendor_invoice_items(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_transaction_datetime ON expenses(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_expense_categories_deleted_at ON expense_categories(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_day_closing_reports_business_date ON day_closing_reports(business_date);
  `);
}

function seedExpenseCategories(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM expense_categories').get() as { count: number };
  if (count.count > 0) return;

  const categories = [
    'Electricity Bill',
    'Travelling Expense',
    'Employee Salary',
    'Daily Wages',
    'Vehicle Expenses',
    'Office Rent',
    'Miscellaneous Expenses',
  ];

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO expense_categories (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((cats: string[]) => {
    for (const name of cats) {
      insert.run(crypto.randomUUID(), name, now, now);
    }
  });

  insertMany(categories);
}

function seedOwner(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (count.count > 0) return;

  const now = new Date().toISOString();

  const email = process.env.OWNER_EMAIL || 'owner@pos.com';
  if (!isAllowedEmailDomain(email)) {
    const domain = String(email).includes('@') ? String(email).split('@')[1] : '(missing)';
    throw new Error(`Seed failed: email domain "${domain}" is not allowed.`);
  }
  const password = process.env.OWNER_PASSWORD || 'owner123';
  const fullName = process.env.OWNER_NAME || 'Owner';
  const username = process.env.OWNER_USERNAME || 'owner';

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, full_name, email, username, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), fullName, email, username, hashedPassword, now, now);

  console.log(`Owner seeded: ${email} / ${password}`);
}
