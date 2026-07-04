import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'pos.db');
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);
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
      sycned INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id)
    );

    CREATE TABLE IF NOT EXISTS day_closing_reports (
      id TEXT PRIMARY KEY,
      business_date TEXT NOT NULL UNIQUE,
      total_sales REAL NOT NULL DEFAULT 0,
      total_purchases REAL NOT NULL DEFAULT 0,
      total_expenses REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function createIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON vendors(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at ON inventory(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_id ON vendor_ledger(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_product_id ON vendor_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_transaction_datetime ON vendor_ledger(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_deleted_at ON vendor_ledger(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_product_id ON customer_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_transaction_datetime ON customer_ledger(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_customer_ledger_deleted_at ON customer_ledger(deleted_at);

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
  const password = process.env.OWNER_PASSWORD || 'owner123';
  const fullName = process.env.OWNER_NAME || 'Owner';
  const username = process.env.OWNER_USERNAME || 'owner';

  db.prepare(`
    INSERT INTO users (id, full_name, email, username, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), fullName, email, username, password, now, now);

  console.log(`Owner seeded: ${email} / ${password}`);
}
