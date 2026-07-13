import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import path from 'path';

config(); // load .env

const url = process.env.TURSO_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO_URL or TURSO_AUTH_TOKEN in .env");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function migrate() {
  console.log("Starting remote Turso migration...");
  try {
    const stmts = [
      "PRAGMA foreign_keys=OFF",
      
      // Vendor Ledger Migration
      `CREATE TABLE vendor_ledger_new (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL,
        transaction_datetime TEXT NOT NULL,
        description TEXT,
        vehicle_number TEXT,
        total_payment REAL NOT NULL CHECK (total_payment >= 0),
        paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
        remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        vendor_invoice_id TEXT DEFAULT NULL,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id),
        FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id)
      )`,
      `INSERT INTO vendor_ledger_new (
        id, vendor_id, transaction_datetime, description, vehicle_number, 
        total_payment, paid_amount, remaining_balance, created_at, updated_at, 
        deleted_at, synced, vendor_invoice_id
      ) SELECT 
        id, vendor_id, transaction_datetime, description, vehicle_number, 
        total_payment, paid_amount, remaining_balance, created_at, updated_at, 
        deleted_at, synced, vendor_invoice_id
      FROM vendor_ledger`,
      "DROP TABLE vendor_ledger",
      "ALTER TABLE vendor_ledger_new RENAME TO vendor_ledger",

      // Customer Ledger Migration
      `CREATE TABLE customer_ledger_new (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        transaction_datetime TEXT NOT NULL,
        description TEXT,
        vehicle_number TEXT,
        total_payment REAL NOT NULL CHECK (total_payment >= 0),
        paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
        remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NULL,
        synced INTEGER NOT NULL DEFAULT 0,
        invoice_id TEXT DEFAULT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      )`,
      `INSERT INTO customer_ledger_new (
        id, customer_id, transaction_datetime, description, vehicle_number, 
        total_payment, paid_amount, remaining_balance, created_at, updated_at, 
        deleted_at, synced, invoice_id
      ) SELECT 
        id, customer_id, transaction_datetime, description, vehicle_number, 
        total_payment, paid_amount, remaining_balance, created_at, updated_at, 
        deleted_at, synced, invoice_id
      FROM customer_ledger`,
      "DROP TABLE customer_ledger",
      "ALTER TABLE customer_ledger_new RENAME TO customer_ledger",

      "PRAGMA foreign_keys=ON"
    ];

    await client.executeMultiple(stmts.join('; '));
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migrate();
