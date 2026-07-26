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
  seedOwner(db);
  seedExtraUsers(db);

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
  'day_closing_reports',
  'vendor_invoices',
  'invoices',
  'expenses',
  'vendor_ledger',
  'vendor_invoice_items',
  'customer_ledger',
  'invoice_items',
  'audit_logs',
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
      opening_balance REAL NOT NULL DEFAULT 0,
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
      transaction_datetime TEXT NOT NULL,
      description TEXT,
      vehicle_number TEXT,
      total_payment REAL NOT NULL CHECK (total_payment >= 0),
      paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
      remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
      transaction_type TEXT NOT NULL DEFAULT 'purchase',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      vendor_invoice_id TEXT DEFAULT NULL,
      linked_entry_id TEXT DEFAULT NULL,
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id)
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
      transaction_datetime TEXT NOT NULL,
      description TEXT,
      vehicle_number TEXT,
      total_payment REAL NOT NULL CHECK (total_payment >= 0),
      paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
      remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
      transaction_type TEXT NOT NULL DEFAULT 'sale',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      invoice_id TEXT DEFAULT NULL,
      linked_entry_id TEXT DEFAULT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL CHECK (action IN ('sync', 'pull', 'export', 'import', 'nuke')),
      status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
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

  const vCols = tableCols('vendors');
  if (!vCols.includes('opening_balance')) {
    addColumn('vendors', 'opening_balance REAL NOT NULL DEFAULT 0');
  }

  const cCols = tableCols('customers');
  if (!cCols.includes('opening_balance')) {
    addColumn('customers', 'opening_balance REAL NOT NULL DEFAULT 0');
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

  // Ensure invoice tables exist for existing users before migrating vendor_ledger
  db.exec(`
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
  `);

  const vlCols = tableCols('vendor_ledger');
  if (!vlCols.includes('vendor_invoice_id')) {
    addColumn('vendor_ledger', 'vendor_invoice_id TEXT DEFAULT NULL');
  }
  if (vlCols.includes('product_id')) {
    // Migration: remove product_id, quantity, rate_per_unit
    db.transaction(() => {
      // 1. Create new table without those columns
      db.exec(`
        CREATE TABLE vendor_ledger_new (
          id TEXT PRIMARY KEY,
          vendor_id TEXT NOT NULL,
          transaction_datetime TEXT NOT NULL,
          description TEXT,
          vehicle_number TEXT,
          total_payment REAL NOT NULL CHECK (total_payment >= 0),
          paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
          remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
          transaction_type TEXT NOT NULL DEFAULT 'purchase',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          vendor_invoice_id TEXT DEFAULT NULL,
          FOREIGN KEY (vendor_id) REFERENCES vendors(id),
          FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id)
        )
      `);
      // 2. Copy data
      db.exec(`
        INSERT INTO vendor_ledger_new (
          id, vendor_id, transaction_datetime, description, vehicle_number,
          total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at,
          deleted_at, synced, vendor_invoice_id
        )
        SELECT 
          id, vendor_id, transaction_datetime, description, vehicle_number,
          total_payment, paid_amount, remaining_balance, 'purchase', created_at, updated_at,
          deleted_at, synced, vendor_invoice_id
        FROM vendor_ledger
      `);
      // 3. Drop old table
      db.exec('DROP TABLE vendor_ledger');
      // 4. Rename new table
      db.exec('ALTER TABLE vendor_ledger_new RENAME TO vendor_ledger');
    })();
  }

  // Migration: add transaction_type column
  if (!vlCols.includes('transaction_type')) {
    addColumn('vendor_ledger', 'transaction_type TEXT NOT NULL DEFAULT \'purchase\'');
  }

  const clCols = tableCols('customer_ledger');
  if (!clCols.includes('invoice_id')) {
    addColumn('customer_ledger', 'invoice_id TEXT DEFAULT NULL');
  }
  if (clCols.includes('product_id')) {
    // Migration: remove product_id, quantity, rate_per_unit
    db.transaction(() => {
      // 1. Create new table without those columns
      db.exec(`
        CREATE TABLE customer_ledger_new (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          transaction_datetime TEXT NOT NULL,
          description TEXT,
          vehicle_number TEXT,
          total_payment REAL NOT NULL CHECK (total_payment >= 0),
          paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
          remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
          transaction_type TEXT NOT NULL DEFAULT 'sale',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          invoice_id TEXT DEFAULT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )
      `);
      // 2. Copy data
      db.exec(`
        INSERT INTO customer_ledger_new (
          id, customer_id, transaction_datetime, description, vehicle_number,
          total_payment, paid_amount, remaining_balance, transaction_type, created_at, updated_at,
          deleted_at, synced, invoice_id
        )
        SELECT 
          id, customer_id, transaction_datetime, description, vehicle_number,
          total_payment, paid_amount, remaining_balance, 'sale', created_at, updated_at,
          deleted_at, synced, invoice_id
        FROM customer_ledger
      `);
      // 3. Drop old table
      db.exec('DROP TABLE customer_ledger');
      // 4. Rename new table
      db.exec('ALTER TABLE customer_ledger_new RENAME TO customer_ledger');
    })();
  }

  // Migration: add transaction_type column to customer_ledger
  if (!clCols.includes('transaction_type')) {
    addColumn('customer_ledger', 'transaction_type TEXT NOT NULL DEFAULT \'sale\'');
  }

  const alCols = tableCols('audit_logs');
  if (alCols.length > 0) {
    if (!alCols.includes('updated_at')) {
      addColumn('audit_logs', "updated_at TEXT NOT NULL DEFAULT ''");
      db.exec(`UPDATE audit_logs SET updated_at = created_at WHERE updated_at = ''`);
    }
    if (!alCols.includes('deleted_at')) {
      addColumn('audit_logs', 'deleted_at TEXT NULL');
    }
    if (!alCols.includes('synced')) {
      addColumn('audit_logs', 'synced INTEGER NOT NULL DEFAULT 0');
    }

    // Recreate audit_logs with updated CHECK constraint to include 'nuke'
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE audit_logs_new (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL CHECK (action IN ('sync', 'pull', 'export', 'import', 'nuke')),
          status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          details TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT NULL,
          synced INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);
      db.exec(`
        INSERT INTO audit_logs_new (id, action, status, user_id, user_name, details, created_at, updated_at, deleted_at, synced)
        SELECT id, action, status, user_id, user_name, details, created_at, updated_at, deleted_at, synced
        FROM audit_logs
      `);
      db.exec('DROP TABLE audit_logs');
      db.exec('ALTER TABLE audit_logs_new RENAME TO audit_logs');
    })();
    db.pragma('foreign_keys = ON');
  }

  // linked_entry_id for cascade delete between vendor_ledger and customer_ledger
  const vlColsLink = tableCols('vendor_ledger');
  if (!vlColsLink.includes('linked_entry_id')) {
    addColumn('vendor_ledger', 'linked_entry_id TEXT DEFAULT NULL');
  }
  const clColsLink = tableCols('customer_ledger');
  if (!clColsLink.includes('linked_entry_id')) {
    addColumn('customer_ledger', 'linked_entry_id TEXT DEFAULT NULL');
  }
}

function createIndexes(db: Database.Database): void {
  const syncedTables = [
    'vendors', 'customers', 'inventory',
    'vendor_ledger', 'vendor_invoices', 'vendor_invoice_items',
    'customer_ledger', 'invoices', 'invoice_items',
    'expense_categories', 'expenses',
    'day_closing_reports', 'users', 'audit_logs'
  ];
  for (const table of syncedTables) {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_synced ON ${table}(synced)`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON vendors(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at ON inventory(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_id ON vendor_ledger(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_transaction_datetime ON vendor_ledger(transaction_datetime);
    CREATE INDEX IF NOT EXISTS idx_vendor_ledger_deleted_at ON vendor_ledger(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_vendor_id ON vendor_invoices(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_issue_date ON vendor_invoices(issue_date);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_due_date ON vendor_invoices(due_date);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_status ON vendor_invoices(status);
    CREATE INDEX IF NOT EXISTS idx_vendor_invoices_deleted_at ON vendor_invoices(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer_id ON customer_ledger(customer_id);
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
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_deleted_at ON audit_logs(deleted_at);
  `);
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

function seedExtraUsers(db: Database.Database): void {
  const now = new Date().toISOString();
  const users: { email: string; password: string; fullName: string; username: string }[] = [
    { email: 'awais@gmail.com', password: 'Awais@1234', fullName: 'Awais', username: 'awais' },
  ];
  for (const u of users) {
    const exists = db.prepare('SELECT COUNT(*) as count FROM users WHERE email = ?').get(u.email) as { count: number };
    if (exists.count === 0) {
      const hashed = bcrypt.hashSync(u.password, 10);
      db.prepare(`INSERT INTO users (id, full_name, email, username, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(crypto.randomUUID(), u.fullName, u.email, u.username, hashed, now, now);
      console.log(`User seeded: ${u.email} / ${u.password}`);
    }
  }
}
