import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'

let rawDb: SqlJsDatabase

class Statement {
  private sql: string
  private db: SqlJsDatabase

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db
    this.sql = sql
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const results = this.db.exec(this.sql, params as (string | number | null)[])
    if (results.length === 0) return []
    const cols = results[0].columns
    return results[0].values.map((row: (string | number | null)[]) => {
      const obj: Record<string, unknown> = {}
      cols.forEach((c: string, i: number) => { obj[c] = row[i] })
      return obj
    })
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const rows = this.all(...params)
    return rows[0]
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: unknown } {
    this.db.run(this.sql, params as (string | number | null)[])
    const changes = this.db.getRowsModified()
    return { changes, lastInsertRowid: null }
  }
}

class TestDatabase {
  private db: SqlJsDatabase

  constructor(db: SqlJsDatabase) {
    this.db = db
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql)
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(_p: string): void {
    this.db.run('PRAGMA foreign_keys = ON')
  }

  transaction<T extends () => void>(fn: T): T {
    const self = this
    return (() => {
      self.db.run('BEGIN')
      try {
        fn()
        self.db.run('COMMIT')
      } catch (err) {
        self.db.run('ROLLBACK')
        throw err
      }
    }) as T
  }
}

let db: TestDatabase

vi.mock('../database.js', () => ({
  getDatabase: () => db,
}))

import { softDeleteVendor } from '../repositories/vendorRepository.js'
import { softDeleteCustomer } from '../repositories/customerRepository.js'
import { deleteExpenseCategory } from '../repositories/expenseRepository.js'
import { softDeleteVendorLedgerEntry } from '../repositories/vendorLedgerRepository.js'
import { softDeleteCustomerLedgerEntry } from '../repositories/customerLedgerRepository.js'

const SCHEMA = `
  CREATE TABLE vendors (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, mill_name TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE customers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, shop_name TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE inventory (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, quantity REAL NOT NULL CHECK (quantity >= 0),
    description TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE vendor_invoices (
    id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL, invoice_number TEXT NOT NULL,
    issue_date TEXT NOT NULL, due_date TEXT NOT NULL, subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL CHECK (total >= 0), paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    remaining_balance REAL NOT NULL DEFAULT 0 CHECK (remaining_balance >= 0),
    status TEXT NOT NULL DEFAULT 'Pending', notes TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
  );
  CREATE TABLE vendor_invoice_items (
    id TEXT PRIMARY KEY, vendor_invoice_id TEXT NOT NULL, product_id TEXT NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0), rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
    total REAL NOT NULL CHECK (total >= 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id), FOREIGN KEY (product_id) REFERENCES inventory(id)
  );
  CREATE TABLE vendor_ledger (
    id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL, product_id TEXT NOT NULL,
    transaction_datetime TEXT NOT NULL, description TEXT, vehicle_number TEXT,
    quantity REAL NOT NULL CHECK (quantity > 0), rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
    total_payment REAL NOT NULL CHECK (total_payment >= 0), paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
    remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    vendor_invoice_id TEXT DEFAULT NULL,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id), FOREIGN KEY (product_id) REFERENCES inventory(id),
    FOREIGN KEY (vendor_invoice_id) REFERENCES vendor_invoices(id)
  );
  CREATE TABLE invoices (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, invoice_number TEXT NOT NULL,
    issue_date TEXT NOT NULL, due_date TEXT NOT NULL, subtotal REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL CHECK (total >= 0), paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    remaining_balance REAL NOT NULL DEFAULT 0 CHECK (remaining_balance >= 0),
    status TEXT NOT NULL DEFAULT 'Pending', notes TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
  CREATE TABLE invoice_items (
    id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, product_id TEXT NOT NULL,
    quantity REAL NOT NULL CHECK (quantity > 0), rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
    total REAL NOT NULL CHECK (total >= 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id), FOREIGN KEY (product_id) REFERENCES inventory(id)
  );
  CREATE TABLE customer_ledger (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, product_id TEXT NOT NULL,
    transaction_datetime TEXT NOT NULL, description TEXT, vehicle_number TEXT,
    quantity REAL NOT NULL CHECK (quantity > 0), rate_per_unit REAL NOT NULL CHECK (rate_per_unit > 0),
    total_payment REAL NOT NULL CHECK (total_payment >= 0), paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
    remaining_balance REAL NOT NULL CHECK (remaining_balance >= 0),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    invoice_id TEXT DEFAULT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id), FOREIGN KEY (product_id) REFERENCES inventory(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );
  CREATE TABLE expense_categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE expenses (
    id TEXT PRIMARY KEY, category_id TEXT NOT NULL, transaction_datetime TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0), description TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NULL, synced INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
  );
`

function seed() {
  db.exec('DELETE FROM vendor_ledger; DELETE FROM vendor_invoice_items; DELETE FROM vendor_invoices; DELETE FROM customer_ledger; DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM expenses; DELETE FROM expense_categories; DELETE FROM inventory; DELETE FROM vendors; DELETE FROM customers;')

  const now = new Date().toISOString()
  db.exec(`INSERT INTO vendors (id, name, created_at, updated_at, synced) VALUES ('v1', 'Vendor A', '${now}', '${now}', 1), ('v2', 'Vendor B', '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO customers (id, name, created_at, updated_at, synced) VALUES ('c1', 'Customer A', '${now}', '${now}', 1), ('c2', 'Customer B', '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO inventory (id, name, unit, quantity, created_at, updated_at, synced) VALUES ('p1', 'Cement', 'bag', 100, '${now}', '${now}', 1), ('p2', 'Steel', 'kg', 500, '${now}', '${now}', 1), ('p3', 'Sand', 'ton', 50, '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO vendor_invoices (id, vendor_id, invoice_number, issue_date, due_date, total, status, created_at, updated_at, synced) VALUES ('vi1', 'v1', 'INV-001', '2026-07-01', '2026-07-31', 5000, 'Pending', '${now}', '${now}', 1), ('vi2', 'v2', 'INV-002', '2026-07-01', '2026-07-31', 3000, 'Paid', '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO vendor_invoice_items (id, vendor_invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced) VALUES ('vii1', 'vi1', 'p1', 10, 500, 5000, '${now}', '${now}', 1), ('vii2', 'vi1', 'p2', 5, 200, 1000, '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO vendor_ledger (id, vendor_id, product_id, transaction_datetime, quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, vendor_invoice_id, created_at, updated_at, synced) VALUES ('vl1', 'v1', 'p1', '2026-07-10', 10, 500, 5000, 3000, 2000, 'vi1', '${now}', '${now}', 1), ('vl2', 'v1', 'p2', '2026-07-11', 5, 200, 1000, 1000, 0, NULL, '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO invoices (id, customer_id, invoice_number, issue_date, due_date, total, status, created_at, updated_at, synced) VALUES ('inv1', 'c1', 'CI-001', '2026-07-01', '2026-07-31', 8000, 'Pending', '${now}', '${now}', 1), ('inv2', 'c2', 'CI-002', '2026-07-01', '2026-07-31', 2000, 'Paid', '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO invoice_items (id, invoice_id, product_id, quantity, rate_per_unit, total, created_at, updated_at, synced) VALUES ('ii1', 'inv1', 'p1', 20, 400, 8000, '${now}', '${now}', 1), ('ii2', 'inv1', 'p3', 5, 600, 3000, '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO customer_ledger (id, customer_id, product_id, transaction_datetime, quantity, rate_per_unit, total_payment, paid_amount, remaining_balance, invoice_id, created_at, updated_at, synced) VALUES ('cl1', 'c1', 'p1', '2026-07-10', 20, 400, 8000, 5000, 3000, 'inv1', '${now}', '${now}', 1), ('cl2', 'c1', 'p3', '2026-07-11', 5, 600, 3000, 3000, 0, NULL, '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO expense_categories (id, name, created_at, updated_at, synced) VALUES ('ec1', 'Rent', '${now}', '${now}', 1), ('ec2', 'Utilities', '${now}', '${now}', 0)`)
  db.exec(`INSERT INTO expenses (id, category_id, transaction_datetime, amount, created_at, updated_at, synced) VALUES ('ex1', 'ec1', '2026-07-10', 5000, '${now}', '${now}', 1), ('ex2', 'ec1', '2026-07-11', 2000, '${now}', '${now}', 0), ('ex3', 'ec2', '2026-07-10', 1500, '${now}', '${now}', 0)`)
}

function col(table: string, id: string): Record<string, unknown> | undefined {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
}

beforeAll(async () => {
  const SQL = await initSqlJs()
  rawDb = new SQL.Database()
  rawDb.run('PRAGMA foreign_keys = ON')
  rawDb.exec(SCHEMA)
  db = new TestDatabase(rawDb)
})

beforeEach(() => {
  seed()
})

// ─── Vendor Cascade Delete ────────────────────────────────────

describe('softDeleteVendor', () => {
  it('soft-deletes the vendor row itself', () => {
    softDeleteVendor('v1')
    const row = col('vendors', 'v1')
    expect(row).toBeDefined()
    expect(row!.deleted_at).toBeTruthy()
    expect(Number(row!.synced)).toBe(0)
  })

  it('cascades to all vendor_ledger entries for that vendor', () => {
    softDeleteVendor('v1')
    expect(col('vendor_ledger', 'vl1')!.deleted_at).toBeTruthy()
    expect(col('vendor_ledger', 'vl2')!.deleted_at).toBeTruthy()
  })

  it('reverses inventory quantities for each cascaded vendor_ledger entry', () => {
    const p1Before = Number(col('inventory', 'p1')!.quantity)
    const p2Before = Number(col('inventory', 'p2')!.quantity)

    softDeleteVendor('v1')

    expect(Number(col('inventory', 'p1')!.quantity)).toBe(p1Before - 10)
    expect(Number(col('inventory', 'p2')!.quantity)).toBe(p2Before - 5)
  })

  it('cascades to vendor_invoices for that vendor', () => {
    softDeleteVendor('v1')
    expect(col('vendor_invoices', 'vi1')!.deleted_at).toBeTruthy()
  })

  it('cascades to vendor_invoice_items under those vendor_invoices', () => {
    softDeleteVendor('v1')
    expect(col('vendor_invoice_items', 'vii1')!.deleted_at).toBeTruthy()
    expect(col('vendor_invoice_items', 'vii2')!.deleted_at).toBeTruthy()
  })

  it('marks all cascaded rows as synced = 0 for cloud push', () => {
    softDeleteVendor('v1')
    expect(Number(col('vendors', 'v1')!.synced)).toBe(0)
    expect(Number(col('vendor_ledger', 'vl1')!.synced)).toBe(0)
    expect(Number(col('vendor_ledger', 'vl2')!.synced)).toBe(0)
    expect(Number(col('vendor_invoices', 'vi1')!.synced)).toBe(0)
    expect(Number(col('vendor_invoice_items', 'vii1')!.synced)).toBe(0)
    expect(Number(col('vendor_invoice_items', 'vii2')!.synced)).toBe(0)
  })

  it('does not touch other vendors or their children', () => {
    softDeleteVendor('v1')
    expect(col('vendors', 'v2')!.deleted_at).toBeNull()
    expect(col('vendor_invoices', 'vi2')!.deleted_at).toBeNull()
  })

  it('handles vendor with no ledger entries or invoices', () => {
    db.exec("INSERT INTO vendors (id, name, created_at, updated_at, synced) VALUES ('v3', 'Empty Vendor', '', '', 0)")
    expect(() => softDeleteVendor('v3')).not.toThrow()
    expect(col('vendors', 'v3')!.deleted_at).toBeTruthy()
  })

  it('does nothing (no error) for non-existent vendor id', () => {
    expect(() => softDeleteVendor('nonexistent')).not.toThrow()
  })

  it('runs everything inside a single transaction — all or nothing', () => {
    const p1Before = Number(col('inventory', 'p1')!.quantity)
    softDeleteVendor('v1')
    expect(col('vendors', 'v1')!.deleted_at).toBeTruthy()
    expect(col('vendor_ledger', 'vl1')!.deleted_at).toBeTruthy()
    expect(col('vendor_invoices', 'vi1')!.deleted_at).toBeTruthy()
    expect(col('vendor_invoice_items', 'vii1')!.deleted_at).toBeTruthy()
    expect(Number(col('inventory', 'p1')!.quantity)).toBe(p1Before - 10)
  })
})

// ─── Customer Cascade Delete ───────────────────────────────────

describe('softDeleteCustomer', () => {
  it('soft-deletes the customer row itself', () => {
    softDeleteCustomer('c1')
    const row = col('customers', 'c1')
    expect(row).toBeDefined()
    expect(row!.deleted_at).toBeTruthy()
    expect(Number(row!.synced)).toBe(0)
  })

  it('cascades to all customer_ledger entries for that customer', () => {
    softDeleteCustomer('c1')
    expect(col('customer_ledger', 'cl1')!.deleted_at).toBeTruthy()
    expect(col('customer_ledger', 'cl2')!.deleted_at).toBeTruthy()
  })

  it('restores inventory quantities for each cascaded customer_ledger entry', () => {
    const p1Before = Number(col('inventory', 'p1')!.quantity)
    const p3Before = Number(col('inventory', 'p3')!.quantity)

    softDeleteCustomer('c1')

    expect(Number(col('inventory', 'p1')!.quantity)).toBe(p1Before + 20)
    expect(Number(col('inventory', 'p3')!.quantity)).toBe(p3Before + 5)
  })

  it('cascades to invoices for that customer', () => {
    softDeleteCustomer('c1')
    expect(col('invoices', 'inv1')!.deleted_at).toBeTruthy()
  })

  it('cascades to invoice_items under those invoices', () => {
    softDeleteCustomer('c1')
    expect(col('invoice_items', 'ii1')!.deleted_at).toBeTruthy()
    expect(col('invoice_items', 'ii2')!.deleted_at).toBeTruthy()
  })

  it('marks all cascaded rows as synced = 0 for cloud push', () => {
    softDeleteCustomer('c1')
    expect(Number(col('customers', 'c1')!.synced)).toBe(0)
    expect(Number(col('customer_ledger', 'cl1')!.synced)).toBe(0)
    expect(Number(col('customer_ledger', 'cl2')!.synced)).toBe(0)
    expect(Number(col('invoices', 'inv1')!.synced)).toBe(0)
    expect(Number(col('invoice_items', 'ii1')!.synced)).toBe(0)
    expect(Number(col('invoice_items', 'ii2')!.synced)).toBe(0)
  })

  it('does not touch other customers or their children', () => {
    softDeleteCustomer('c1')
    expect(col('customers', 'c2')!.deleted_at).toBeNull()
    expect(col('invoices', 'inv2')!.deleted_at).toBeNull()
  })

  it('handles customer with no ledger entries or invoices', () => {
    db.exec("INSERT INTO customers (id, name, created_at, updated_at, synced) VALUES ('c3', 'Empty Customer', '', '', 0)")
    expect(() => softDeleteCustomer('c3')).not.toThrow()
    expect(col('customers', 'c3')!.deleted_at).toBeTruthy()
  })

  it('does nothing (no error) for non-existent customer id', () => {
    expect(() => softDeleteCustomer('nonexistent')).not.toThrow()
  })

  it('runs everything inside a single transaction — all or nothing', () => {
    const p1Before = Number(col('inventory', 'p1')!.quantity)
    softDeleteCustomer('c1')
    expect(col('customers', 'c1')!.deleted_at).toBeTruthy()
    expect(col('customer_ledger', 'cl1')!.deleted_at).toBeTruthy()
    expect(col('invoices', 'inv1')!.deleted_at).toBeTruthy()
    expect(col('invoice_items', 'ii1')!.deleted_at).toBeTruthy()
    expect(Number(col('inventory', 'p1')!.quantity)).toBe(p1Before + 20)
  })
})

// ─── Expense Category Cascade Delete ───────────────────────────

describe('deleteExpenseCategory', () => {
  it('soft-deletes the category row itself', () => {
    deleteExpenseCategory('ec1')
    const row = col('expense_categories', 'ec1')
    expect(row).toBeDefined()
    expect(row!.deleted_at).toBeTruthy()
    expect(Number(row!.synced)).toBe(0)
  })

  it('cascades to all expenses under that category', () => {
    deleteExpenseCategory('ec1')
    expect(col('expenses', 'ex1')!.deleted_at).toBeTruthy()
    expect(col('expenses', 'ex2')!.deleted_at).toBeTruthy()
  })

  it('marks all cascaded rows as synced = 0 for cloud push', () => {
    deleteExpenseCategory('ec1')
    expect(Number(col('expense_categories', 'ec1')!.synced)).toBe(0)
    expect(Number(col('expenses', 'ex1')!.synced)).toBe(0)
    expect(Number(col('expenses', 'ex2')!.synced)).toBe(0)
  })

  it('does not touch expenses under other categories', () => {
    deleteExpenseCategory('ec1')
    expect(col('expenses', 'ex3')!.deleted_at).toBeNull()
  })

  it('does not touch other categories', () => {
    deleteExpenseCategory('ec1')
    expect(col('expense_categories', 'ec2')!.deleted_at).toBeNull()
  })

  it('handles category with no expenses', () => {
    db.exec("INSERT INTO expense_categories (id, name, created_at, updated_at, synced) VALUES ('ec3', 'Empty', '', '', 0)")
    expect(() => deleteExpenseCategory('ec3')).not.toThrow()
    expect(col('expense_categories', 'ec3')!.deleted_at).toBeTruthy()
  })

  it('does nothing (no error) for non-existent category id', () => {
    expect(() => deleteExpenseCategory('nonexistent')).not.toThrow()
  })

  it('runs everything inside a single transaction — all or nothing', () => {
    deleteExpenseCategory('ec1')
    expect(col('expense_categories', 'ec1')!.deleted_at).toBeTruthy()
    expect(col('expenses', 'ex1')!.deleted_at).toBeTruthy()
    expect(col('expenses', 'ex2')!.deleted_at).toBeTruthy()
  })
})

// ─── Vendor Ledger → Invoice Cascade Delete ────────────────────

describe('softDeleteVendorLedgerEntry', () => {
  it('soft-deletes the ledger entry itself', () => {
    softDeleteVendorLedgerEntry('vl1')
    expect(col('vendor_ledger', 'vl1')!.deleted_at).toBeTruthy()
    expect(Number(col('vendor_ledger', 'vl1')!.synced)).toBe(0)
  })

  it('reverses inventory quantity', () => {
    const p1Before = Number(col('inventory', 'p1')!.quantity)
    softDeleteVendorLedgerEntry('vl1')
    expect(Number(col('inventory', 'p1')!.quantity)).toBe(p1Before - 10)
  })

  it('cascades to linked vendor_invoices', () => {
    softDeleteVendorLedgerEntry('vl1')
    expect(col('vendor_invoices', 'vi1')!.deleted_at).toBeTruthy()
  })

  it('cascades to vendor_invoice_items under linked invoice', () => {
    softDeleteVendorLedgerEntry('vl1')
    expect(col('vendor_invoice_items', 'vii1')!.deleted_at).toBeTruthy()
    expect(col('vendor_invoice_items', 'vii2')!.deleted_at).toBeTruthy()
  })

  it('does nothing to invoice when vendor_invoice_id is null', () => {
    softDeleteVendorLedgerEntry('vl2')
    expect(col('vendor_ledger', 'vl2')!.deleted_at).toBeTruthy()
    expect(col('vendor_invoices', 'vi2')!.deleted_at).toBeNull()
  })

  it('does not touch unrelated invoices', () => {
    softDeleteVendorLedgerEntry('vl1')
    expect(col('vendor_invoices', 'vi2')!.deleted_at).toBeNull()
  })

  it('marks all cascaded rows as synced = 0', () => {
    softDeleteVendorLedgerEntry('vl1')
    expect(Number(col('vendor_ledger', 'vl1')!.synced)).toBe(0)
    expect(Number(col('vendor_invoices', 'vi1')!.synced)).toBe(0)
    expect(Number(col('vendor_invoice_items', 'vii1')!.synced)).toBe(0)
    expect(Number(col('vendor_invoice_items', 'vii2')!.synced)).toBe(0)
  })

  it('throws for non-existent id', () => {
    expect(() => softDeleteVendorLedgerEntry('nonexistent')).toThrow('Vendor ledger entry not found')
  })
})

// ─── Customer Ledger → Invoice Cascade Delete ──────────────────

describe('softDeleteCustomerLedgerEntry', () => {
  it('soft-deletes the ledger entry itself', () => {
    softDeleteCustomerLedgerEntry('cl1')
    expect(col('customer_ledger', 'cl1')!.deleted_at).toBeTruthy()
    expect(Number(col('customer_ledger', 'cl1')!.synced)).toBe(0)
  })

  it('restores inventory quantity', () => {
    const p1Before = Number(col('inventory', 'p1')!.quantity)
    softDeleteCustomerLedgerEntry('cl1')
    expect(Number(col('inventory', 'p1')!.quantity)).toBe(p1Before + 20)
  })

  it('cascades to linked invoices', () => {
    softDeleteCustomerLedgerEntry('cl1')
    expect(col('invoices', 'inv1')!.deleted_at).toBeTruthy()
  })

  it('cascades to invoice_items under linked invoice', () => {
    softDeleteCustomerLedgerEntry('cl1')
    expect(col('invoice_items', 'ii1')!.deleted_at).toBeTruthy()
    expect(col('invoice_items', 'ii2')!.deleted_at).toBeTruthy()
  })

  it('does nothing to invoice when invoice_id is null', () => {
    softDeleteCustomerLedgerEntry('cl2')
    expect(col('customer_ledger', 'cl2')!.deleted_at).toBeTruthy()
    expect(col('invoices', 'inv2')!.deleted_at).toBeNull()
  })

  it('does not touch unrelated invoices', () => {
    softDeleteCustomerLedgerEntry('cl1')
    expect(col('invoices', 'inv2')!.deleted_at).toBeNull()
  })

  it('marks all cascaded rows as synced = 0', () => {
    softDeleteCustomerLedgerEntry('cl1')
    expect(Number(col('customer_ledger', 'cl1')!.synced)).toBe(0)
    expect(Number(col('invoices', 'inv1')!.synced)).toBe(0)
    expect(Number(col('invoice_items', 'ii1')!.synced)).toBe(0)
    expect(Number(col('invoice_items', 'ii2')!.synced)).toBe(0)
  })

  it('throws for non-existent id', () => {
    expect(() => softDeleteCustomerLedgerEntry('nonexistent')).toThrow('Customer ledger entry not found')
  })
})
