# Database Implementation — Full Explanation

## 1. What was implemented

A **production-ready SQLite database** for an Electron POS (Point of Sale) application used by a construction materials business. The implementation lives entirely in the **Electron main process** (the Node.js backend) and is exposed to the **React frontend** through a secure bridge.

### Files touched 

| File | Action | Role |
|---|---|---|
| `src/electron/database.ts` | **Created** | Database initialization, schema, indexes, seeds |
| `src/electron/main.ts` | **Modified** | App lifecycle (init DB on start, close DB on quit), IPC handler registration |
| `src/electron/preload.cts` | **Modified** | Bridges DB API from main process → renderer process |

---

## 2. Why this is needed

### Electron architecture: two processes

Electron apps have two separate JavaScript environments:

```
┌──────────────────────────────────────────────────┐
│                 Main Process                      │
│  (Node.js — has full system access)              │
│  - File system                                   │
│  - SQLite (better-sqlite3)                       │
│  - Window management                             │
│  - OS-level APIs                                 │
└──────────────┬───────────────────────────────────┘
               │  IPC (Inter-Process Communication)
               │  via ipcMain / ipcRenderer
               ▼
┌──────────────────────────────────────────────────┐
│               Renderer Process                   │
│  (Chromium — browser sandbox)                   │
│  - React UI                                      │
│  - DOM APIs only                                 │
│  - NO direct file system access                  │
└──────────────────────────────────────────────────┘
```

**You cannot run SQLite in the renderer process.** The renderer is sandboxed — it has no `require()`, no `fs`, no `path`. Even if you could, it would be a security disaster (any XSS bug would give attackers full database access).

So the database **must** live in the main process, and the renderer communicates with it through **IPC** (Inter-Process Communication).

---

## 3. How it works — end to end

### Step 1: App starts

```ts
// main.ts
app.whenReady().then(() => {
  initDatabase()    // <-- creates/opens the SQLite database
  createWindow()    // <-- spawns the React window
})
```

`initDatabase()` in `database.ts`:
1. Determines the database file path: `app.getPath('userData')/pos.db`
   - On Windows: `C:\Users\<you>\AppData\Roaming\pos\pos.db`
   - On macOS: `~/Library/Application Support/pos/pos.db`
   - On Linux: `~/.config/pos/pos.db`
2. Opens (or creates) the SQLite file
3. Enables **WAL mode** — Write-Ahead Logging. Allows concurrent reads while writing. Much faster for a POS app.
4. Enables **foreign key enforcement** — SQLite doesn't enforce FKs by default; this flag turns it on.
5. Runs all `CREATE TABLE IF NOT EXISTS` statements
6. Runs all `CREATE INDEX IF NOT EXISTS` statements
7. Seeds the expense categories (only on first run — checks if table is empty)

### Step 2: Renderer needs data

When the React component needs to query the database, it calls:

```ts
window.electron.db.exec('SELECT * FROM vendors WHERE deleted_at IS NULL')
```

This flows through:

```
React Component
    │
    ▼
window.electron.db.exec(sql, params)
    │  (this calls ipcRenderer.invoke)
    ▼
preload.cts  (context bridge — no Node.js access)
    │
    ▼
IPC channel "db:exec"
    │
    ▼
main.ts handler:
  ipcMain.handle('db:exec', (event, sql, params) => {
    const db = getDatabase()
    const stmt = db.prepare(sql)
    return params ? stmt.all(...params) : stmt.all()
  })
    │
    ▼
better-sqlite3 prepares + executes the SQL
    │
    ▼
Result returned as a plain JavaScript object
    │  (Electron serializes it across IPC automatically)
    ▼
React component receives the data
```

### Step 3: App quits

```ts
app.on('before-quit', () => {
  closeDatabase()   // closes SQLite connection cleanly
})
```

---

## 4. What is `preload.cts`?

`preload.cts` is a **preload script** — a special file that Electron runs in the renderer process **before** the web page loads. It has limited Node.js access (can use `require` for Electron APIs) but runs in a controlled environment.

### Purpose

Electron enforces **Context Isolation** (`contextIsolation: true` in the BrowserWindow config). This means:
- The renderer's JavaScript (React) runs in its own isolated context
- The preload script runs in a separate "isolated world"
- They cannot access each other's variables directly

The way to share functionality is `contextBridge.exposeInMainWorld()`:

```ts
// preload.cts
contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  db: {
    exec: (sql, params) => ipcRenderer.invoke('db:exec', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    transaction: (queries) => ipcRenderer.invoke('db:transaction', queries),
  },
})
```

This makes `window.electron` available in React, with methods that securely communicate with the main process.

### Why `.cts` (not `.ts`)?

`.cts` = **CommonJS TypeScript**. The preload script is loaded by Electron before the module system is set up, so it needs to be CommonJS. The `.cts` extension tells TypeScript to compile it as a CommonJS module, producing `preload.cjs` instead of `preload.mjs` or `preload.js`.

---

## 5. The `database.ts` file — detailed breakdown

### 5a. UUIDs everywhere

Every table uses `id TEXT PRIMARY KEY`. UUIDs are generated with `crypto.randomUUID()` (Node.js built-in). This is better than `INTEGER PRIMARY KEY AUTOINCREMENT` because:
- IDs are **universally unique** — no collision risk if you ever merge databases from multiple machines
- **No sequential guessing** — you can't iterate `?id=1`, `?id=2`, etc.
- Offline-friendly — each POS terminal can generate its own IDs without coordinating

### 5b. Soft deletes

Every table has `deleted_at TEXT NULL`. Records are never physically deleted:
```sql
-- Instead of: DELETE FROM vendors WHERE id = 'xyz'
-- You do:    UPDATE vendors SET deleted_at = '2026-07-05T10:30:00Z' WHERE id = 'xyz'
```

This preserves data integrity — old ledger entries still reference the vendor/customer even after it's "deleted." Most queries filter with `WHERE deleted_at IS NULL`.

### 5c. The `synced` column

`synced INTEGER NOT NULL DEFAULT 0` is a boolean (0 = unsynced, 1 = synced). This prepares the app for a future cloud sync feature. When a record is created or modified locally, `synced` gets set to `0`. A sync process reads all unsynced records, pushes them to a server, then sets `synced = 1`.

### 5d. Table purposes

| Table | Why it exists |
|---|---|
| **vendors** | Stores suppliers the business buys from |
| **customers** | Stores buyers the business sells to |
| **inventory** | Tracks current stock levels only. No rates, no history — those belong in ledgers |
| **vendor_ledger** | Every purchase = one row. Records what was bought, from whom, at what rate, how much was paid, and what's still owed |
| **customer_ledger** | Every sale = one row. Same structure as vendor_ledger but tracks who owes the business money |
| **expense_categories** | Lookup table for categorizing expenses (seeded with 7 defaults) |
| **expenses** | Records daily business expenses like electricity, salaries, travel |
| **day_closing_reports** | Daily snapshots — stores pre-computed totals for sales, purchases, and expenses on a given date. This is the **only** report table because it captures historical state that can't be re-derived (unlike outstanding balances or profit/loss which can always be computed from raw data) |

### 5e. Constraints enforce business rules at the database level

- `CHECK (quantity >= 0)` on inventory — can't go negative
- `CHECK (quantity > 0)` on ledger entries — can't record zero-quantity purchases/sales
- `CHECK (rate_per_unit > 0)` — can't have zero or negative prices
- `CHECK (total_payment >= 0)`, `paid_amount >= 0`, `remaining_balance >= 0` — money amounts can't be negative
- `CHECK (amount > 0)` on expenses — no zero/negative expense entries
- `name TEXT UNIQUE` on expense_categories — prevents duplicate category names
- All `FOREIGN KEY` constraints — you can't create a vendor_ledger entry for a non-existent vendor, etc.

### 5f. Indexes

16 indexes total. Indexes speed up queries at the cost of slightly slower writes. The indexed columns are:
- **`deleted_at`** — because almost every query filters `WHERE deleted_at IS NULL`
- **Foreign keys** (`vendor_id`, `customer_id`, `product_id`, `category_id`) — because reports and lookups join on these
- **`transaction_datetime`** — because reports filter by date range
- **`business_date`** — because day closing reports are looked up by date

### 5g. WAL mode

`PRAGMA journal_mode = WAL` changes SQLite's write mechanism from the default "delete journal" to "write-ahead logging." Benefits:
- **Multiple readers can read while one writer writes** — critical for a POS app
- Writes are much faster
- Database is less prone to corruption on crash

---

## 6. The three IPC handlers

### `db:exec` — General purpose query

```ts
ipcMain.handle('db:exec', (_event, sql: string, params?: unknown[]) => {
  const db = getDatabase()
  const stmt = db.prepare(sql)
  // SELECT queries return all matching rows
  if (sql.trim().toLowerCase().startsWith('select')) {
    return params ? stmt.all(...params) : stmt.all()
  }
  // INSERT/UPDATE/DELETE return run result (changes, lastInsertRowid)
  return params ? stmt.run(...params) : stmt.run()
})
```

Used for: most queries — SELECT, INSERT, UPDATE, DELETE.

### `db:get` — Single row fetch

```ts
ipcMain.handle('db:get', (_event, sql: string, params?: unknown[]) => {
  const db = getDatabase()
  const stmt = db.prepare(sql)
  return params ? stmt.get(...params) : stmt.get()
})
```

Used for: fetching a single record by ID, or checking existence. Returns one row or `undefined`.

### `db:transaction` — Atomic multi-statement execution

```ts
ipcMain.handle('db:transaction', (_event, queries) => {
  const db = getDatabase()
  const transaction = db.transaction(() => {
    const results = []
    for (const q of queries) {
      const stmt = db.prepare(q.sql)
      results.push(q.params ? stmt.run(...q.params) : stmt.run())
    }
    return results
  })
  return transaction()
})
```

Used for: operations that MUST be atomic. Example — recording a sale:
```ts
window.electron.db.transaction([
  { sql: 'INSERT INTO customer_ledger (...) VALUES (...)', params: [...] },
  { sql: 'UPDATE inventory SET quantity = quantity - ? WHERE id = ?', params: [qty, productId] },
])
```

If the INSERT succeeds but the UPDATE fails, the INSERT is **rolled back**. The inventory and ledger are always in sync.

### SQL injection protection

All three handlers accept **parameterized queries** (`params` array). Never concatenate user input into SQL strings. `better-sqlite3` handles escaping — values are bound safely.

---

## 7. The seed system

```ts
function seedExpenseCategories(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as count FROM expense_categories').get()
  if (count.count > 0) return  // <-- only seeds on first run

  const categories = [
    'Electricity Bill', 'Travelling Expense', 'Employee Salary',
    'Daily Wages', 'Vehicle Expenses', 'Office Rent', 'Miscellaneous Expenses',
  ]

  const now = new Date().toISOString()
  const insert = db.prepare('INSERT INTO expense_categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
  const insertMany = db.transaction((cats) => {
    for (const name of cats) insert.run(crypto.randomUUID(), name, now, now)
  })
  insertMany(categories)
}
```

- Checks if the table already has rows → skips if yes
- Uses a transaction for performance (one commit for all inserts instead of 7)
- Generates UUIDs with `crypto.randomUUID()`

---

## 8. How the React frontend uses it

Since the Preload script exposes `window.electron.db`, your React code can do things like:

```tsx
// Fetch all active vendors
const vendors = await window.electron.db.exec(
  'SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name'
)

// Fetch a single customer
const customer = await window.electron.db.get(
  'SELECT * FROM customers WHERE id = ?', [customerId]
)

// Record a purchase (atomic: insert ledger + update inventory)
await window.electron.db.transaction([
  {
    sql: `INSERT INTO vendor_ledger
          (id, vendor_id, product_id, transaction_datetime, quantity,
           rate_per_unit, total_payment, paid_amount, remaining_balance,
           created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [uuid, vendorId, productId, datetime, qty, rate, total, paid, remaining, now, now],
  },
  {
    sql: 'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
    params: [qty, productId],
  },
])
```

---

## 9. Summary diagram

```
main.ts (entry point)
    │
    ├── initDatabase()
    │       │
    │       ├── Determines DB path (userData/pos.db)
    │       ├── Opens SQLite via better-sqlite3
    │       ├── PRAGMA journal_mode = WAL
    │       ├── PRAGMA foreign_keys = ON
    │       ├── CREATE TABLE vendors (...)
    │       ├── CREATE TABLE customers (...)
    │       ├── CREATE TABLE inventory (...)
    │       ├── CREATE TABLE vendor_ledger (...)
    │       ├── CREATE TABLE customer_ledger (...)
    │       ├── CREATE TABLE expense_categories (...)
    │       ├── CREATE TABLE expenses (...)
    │       ├── CREATE TABLE day_closing_reports (...)
    │       ├── 16× CREATE INDEX (...)
    │       └── Seed 7 expense categories
    │
    ├── createWindow()
    │       │
    │       └── BrowserWindow { preload: preload.cts, contextIsolation: true }
    │               │
    │               └── preload.cts
    │                       │
    │                       └── contextBridge.exposeInMainWorld('electron', {
    │                               minimize, maximize, close,
    │                               db: { exec, get, transaction }
    │                           })
    │
    ├── ipcMain.handle('db:exec', ...)
    ├── ipcMain.handle('db:get', ...)
    ├── ipcMain.handle('db:transaction', ...)
    │
    └── app.on('before-quit') → closeDatabase()
```
