-- Turso (libsql) schema — mirror of the local POS SQLite schema.
-- Run this once against your Turso database to set it up before syncing.
-- libsql is SQLite-compatible, so these statements are a direct copy
-- of the local CREATE TABLE statements.
--
-- Usage:
--   turso db shell <db-name> < turso-schema.sql

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

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
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
