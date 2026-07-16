# POS App Architecture

## Overview

Electron desktop POS (Point of Sale) app built with React + TypeScript + Vite. Local SQLite database synced to Turso cloud. Version 1.1.2.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 42 |
| Frontend | React 19, React Router 7, Tailwind CSS 3 |
| Build | Vite 8, TypeScript 6 |
| Local DB | better-sqlite3 (SQLite, WAL mode) |
| Cloud DB | Turso (libsql/client) |
| Auth | bcryptjs |
| Export | ExcelJS |
| Testing | Vitest |
| Packaging | electron-builder |

## Directory Structure

```
pos/
├── src/
│   ├── electron/                  # Main process (Node.js)
│   │   ├── main.ts                # Entry point — creates BrowserWindow, inits DB
│   │   ├── preload.cts            # contextBridge — exposes IPC to renderer
│   │   ├── database.ts            # SQLite setup, schema, migrations, indexes
│   │   ├── dbHelpers.ts           # Shared DB helper utilities
│   │   ├── pathResolver.ts        # Resolves preload path
│   │   ├── utils.ts               # isDev() helper
│   │   ├── validation.ts          # Input validators (email, phone, name, etc.)
│   │   ├── seed-cli.ts            # CLI seeding utility
│   │   ├── seed-test-data.ts      # Test data seeding
│   │   ├── __tests__/             # Electron process tests
│   │   │   ├── cascadeDelete.test.ts
│   │   │   └── validation.test.ts
│   │   ├── types/
│   │   │   └── sql.js.d.ts        # Type declarations
│   │   ├── controllers/           # (reserved, currently empty)
│   │   ├── ipc/                   # IPC handlers (main process side)
│   │   │   ├── index.ts           # registerAllIpcHandlers()
│   │   │   ├── authIpc.ts
│   │   │   ├── syncIpc.ts
│   │   │   ├── dbIpc.ts           # export/import database
│   │   │   ├── vendorIpc.ts
│   │   │   ├── customerIpc.ts
│   │   │   ├── inventoryIpc.ts
│   │   │   ├── vendorLedgerIpc.ts
│   │   │   ├── customerLedgerIpc.ts
│   │   │   ├── vendorInvoiceIpc.ts
│   │   │   ├── invoiceIpc.ts
│   │   │   ├── expenseIpc.ts
│   │   │   ├── dayClosingIpc.ts
│   │   │   ├── dashboardIpc.ts
│   │   │   └── auditLogIpc.ts
│   │   ├── repositories/          # Data access layer (SQL queries)
│   │   │   ├── authRepository.ts
│   │   │   ├── vendorRepository.ts
│   │   │   ├── customerRepository.ts
│   │   │   ├── inventoryRepository.ts
│   │   │   ├── vendorLedgerRepository.ts
│   │   │   ├── customerLedgerRepository.ts
│   │   │   ├── vendorInvoiceRepository.ts
│   │   │   ├── invoiceRepository.ts
│   │   │   ├── expenseRepository.ts
│   │   │   ├── dayClosingRepository.ts
│   │   │   ├── dashboardRepository.ts
│   │   │   └── auditLogRepository.ts
│   │   └── sync/                  # Cloud sync engine
│   │       ├── tursoClient.ts     # Turso client setup
│   │       ├── pusher.ts          # Local → Cloud
│   │       ├── puller.ts          # Cloud → Local
│   │       ├── syncEngine.ts      # Orchestrates push + pull
│   │       └── turso-schema.sql
│   │
│   ├── data/                      # Legacy/mock data
│   │   ├── config/colors.ts
│   │   └── dashboardMock.ts
│   │
│   └── ui/                        # Renderer process (React)
│       ├── main.tsx               # React entry, HashRouter
│       ├── App.tsx                # Routes + Layout
│       ├── index.css              # Tailwind base
│       ├── logoConfig.ts          # Logo configuration
│       ├── types/index.ts         # Shared TypeScript types
│       ├── services/
│       │   └── api.ts             # Typed wrapper around window.electron
│       ├── context/
│       │   ├── AuthContext.tsx     # Login state, currentUser
│       │   ├── DataContext.tsx     # Mock data (legacy)
│       │   └── NotificationContext.tsx
│       ├── hooks/
│       │   └── useTheme.ts        # Dark mode toggle
│       ├── assets/
│       │   ├── hero.png
│       │   ├── react.svg
│       │   └── vite.svg
│       ├── components/
│       │   ├── Sidebar.tsx        # Nav menu
│       │   ├── Header.tsx
│       │   ├── Titlebar.tsx       # Custom window titlebar
│       │   ├── ProtectedRoute.tsx # Auth guard
│       │   ├── Logo.tsx
│       │   ├── ThemeSwitch.tsx
│       │   ├── NotificationModal.tsx
│       │   ├── PasswordInput.tsx
│       │   ├── PosBackground.tsx
│       │   ├── ProductLedger.tsx
│       │   ├── AddRecordDrawer.tsx
│       │   ├── AnalyticsChart.tsx
│       │   ├── CalendarModal.tsx
│       │   ├── DonutGrid.tsx
│       │   ├── KPIRow.tsx
│       │   ├── ProfileModal.tsx
│       │   ├── SummaryBreakdown.tsx
│       │   ├── ui/                # Shared UI primitives
│       │   │   ├── ConfirmModal.tsx
│       │   │   ├── DataTable.tsx
│       │   │   ├── DateInput.tsx
│       │   │   ├── DateTimeInput.tsx
│       │   │   ├── Modal.tsx
│       │   │   ├── Pagination.tsx
│       │   │   └── SearchInput.tsx
│       │   └── views/             # Shared view components
│       │       ├── BalanceSheet.tsx
│       │       ├── BankAccountTransaction.tsx
│       │       ├── CustomerDetails.tsx
│       │       ├── DayClosingReport.tsx
│       │       ├── ExpensesDetails.tsx
│       │       ├── InventoryReport.tsx
│       │       ├── InvoiceBills.tsx
│       │       ├── ProfitLossReport.tsx
│       │       └── VendorDetails.tsx
│       └── pages/
│           ├── LoginPage.tsx
│           ├── Dashboard.tsx
│           ├── OrdersPage.tsx          # (exists, not routed)
│           ├── ProductsView.tsx        # (exists, not routed)
│           ├── vendors/VendorsPage.tsx
│           ├── customers/CustomersPage.tsx
│           ├── inventory/InventoryPage.tsx
│           ├── vendor-ledger/VendorLedgerPage.tsx
│           ├── customer-ledger/CustomerLedgerPage.tsx
│           ├── invoices/InvoicesPage.tsx
│           ├── vendor-invoices/VendorInvoicesPage.tsx
│           ├── expenses/ExpensesPage.tsx
│           ├── day-closing/DayClosingPage.tsx
│           └── settings/
│               ├── SettingsPage.tsx
│               └── BackupLogsPage.tsx
├── scripts/                       # Seed scripts
│   ├── seed-owner.js
│   └── seed-test-data.js
├── dist-electron/                 # Compiled electron output
├── dist-react/                    # Compiled React output
├── pos.db                         # SQLite database (local dev)
├── ARCHITECTURE.md
├── package.json
├── vite.config.ts
├── electron-builder.json
└── tsconfig*.json
```

## Data Flow

```
React UI → api.ts → window.electron (preload.cts) → ipcRenderer.invoke() → ipc/*.ts handlers → repositories/*.ts → better-sqlite3
```

Every database operation follows this path:
1. UI calls `api.vendors.list(...)` (in `services/api.ts`)
2. `api.ts` forwards to `window.electron.vendors.list(...)`
3. `preload.cts` invokes `ipcRenderer.invoke('vendors:list', ...)`
4. Main process handler in `ipc/vendorIpc.ts` receives it
5. Handler calls repository function in `repositories/vendorRepository.ts`
6. Repository runs raw SQL via `better-sqlite3`

## Database

- **File**: `D:\pos-data\pos.db` (SQLite, WAL mode, foreign keys ON)
- **Tables**: vendors, customers, inventory, vendor_ledger, vendor_invoices, vendor_invoice_items, customer_ledger, invoices, invoice_items, expense_categories, expenses, day_closing_reports, users, audit_logs
- **Schema**: Defined in `database.ts:createTables()`, migrations in `migrateSchema()`
- **All business tables** have: `id TEXT PK`, `created_at`, `updated_at`, `deleted_at` (soft delete), `synced INTEGER` (0/1)

### Table Details

| Table | Key Columns | Notes |
|-------|------------|-------|
| `vendors` | name, phone, address, mill_name | |
| `customers` | name, phone, address, shop_name | |
| `inventory` | name, unit, quantity (CHECK >= 0), description | 47 allowed unit types |
| `vendor_ledger` | vendor_id FK, transaction_datetime, total_payment, paid_amount, remaining_balance, vendor_invoice_id FK | Auto-creates vendor_invoices |
| `vendor_invoices` | vendor_id FK, invoice_number, status (Pending/Paid/Overdue/Cancelled), total, paid_amount | |
| `vendor_invoice_items` | vendor_invoice_id FK, product_id FK, quantity, rate_per_unit, total | |
| `customer_ledger` | customer_id FK, transaction_datetime, total_payment, paid_amount, remaining_balance, invoice_id FK | Auto-creates invoices |
| `invoices` | customer_id FK, invoice_number, status, total, paid_amount | Mirrors vendor_invoices |
| `invoice_items` | invoice_id FK, product_id FK, quantity, rate_per_unit, total | |
| `expense_categories` | name (UNIQUE) | |
| `expenses` | category_id FK, transaction_datetime, amount, description | |
| `day_closing_reports` | business_date (UNIQUE), total_sales, total_purchases, total_expenses | |
| `users` | full_name, email (UNIQUE), username (UNIQUE), password (bcrypt) | Single owner only |
| `audit_logs` | action (sync/pull/export/import/nuke), status (success/failure/partial), user_id FK, user_name, details | |

**Sync Table Order** (FK-respecting): vendors → customers → inventory → expense_categories → day_closing_reports → vendor_invoices → invoices → expenses → vendor_ledger → vendor_invoice_items → customer_ledger → invoice_items → audit_logs

## Sync Architecture

- **Push** (local → Turso): Iterates `SYNC_TABLE_ORDER`, inserts/updates rows where `synced = 0`
- **Pull** (Turso → local): Fetches rows newer than last sync time, upserts locally
- **Sync order** respects FK dependencies (vendors before vendor_ledger, etc.)
- **Last sync time** tracked in a metadata file
- **Retry logic**: Up to 3 attempts with exponential backoff
- **Progress reporting**: Sends `sync:progress` events to renderer during sync

## IPC Pattern

Each domain has 4 files that must stay in sync:

| File | Role |
|------|------|
| `repositories/*.ts` | SQL queries, pure data access |
| `ipc/*.ts` | `ipcMain.handle('name:action', ...)` handlers |
| `preload.cts` | `ipcRenderer.invoke('name:action', ...)` bridge |
| `services/api.ts` | `window.electron.name.action(...)` typed wrapper |

To add a new IPC endpoint, you must touch all 4 files.

### All IPC Channels

**Window Controls** (fire-and-forget via `ipcMain.on`):

| Channel | Description |
|---------|-------------|
| `window:minimize` | Minimize window |
| `window:maximize` | Toggle maximize |
| `window:close` | Close window |

**Auth** (`authIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `auth:login` | email, password | User object or null |
| `auth:register` | fullName, email, username, password | User object |
| `auth:owner-status` | — | `{ hasOwner: boolean }` |

**Vendors** (`vendorIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `vendors:list` | search?, page?, limit? | Paginated vendor list |
| `vendors:get` | id | Vendor |
| `vendors:create` | name, phone?, address?, mill_name? | Vendor |
| `vendors:update` | id, name, phone?, address?, mill_name? | Vendor |
| `vendors:delete` | id | `{ success }` (cascades) |
| `vendors:outstanding` | id | number |

**Customers** (`customerIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `customers:list` | search?, page?, limit? | Paginated customer list |
| `customers:get` | id | Customer |
| `customers:create` | name, phone?, address?, shop_name? | Customer |
| `customers:update` | id, name, phone?, address?, shop_name? | Customer |
| `customers:delete` | id | `{ success }` (cascades) |
| `customers:outstanding` | id | number |

**Inventory** (`inventoryIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `inventory:list` | search?, page?, limit? | Paginated inventory list |
| `inventory:get` | id | Inventory item |
| `inventory:create` | name, unit, quantity, description? | Inventory item |
| `inventory:update` | id, name, unit, description? | Inventory item |
| `inventory:adjust-stock` | id, quantityChange | Inventory item |
| `inventory:delete` | id | `{ success }` |
| `inventory:low-stock-count` | threshold? | number |

**Vendor Ledger** (`vendorLedgerIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `vendor-ledger:list` | vendorId?, dateFrom?, dateTo?, page?, limit? | Paginated entries |
| `vendor-ledger:get` | id | Entry with items |
| `vendor-ledger:create` | vendorId, datetime, items[], totalPayment, paidAmount, desc?, vehicle?, dueDate? | Ledger entry |
| `vendor-ledger:create-with-new-vendor` | vendorData, purchaseData | Ledger entry (atomic) |
| `vendor-ledger:update` | id, vendorId, datetime, items[], totalPayment, paidAmount, desc?, vehicle?, dueDate? | Ledger entry |
| `vendor-ledger:delete` | id | `{ success }` (cascades, reverses stock) |
| `vendor-ledger:pending` | vendorId | Entries |
| `vendor-ledger:link-to-invoice` | entryIds[], invoiceId | `{ success }` |

**Customer Ledger** (`customerLedgerIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `customer-ledger:list` | customerId?, dateFrom?, dateTo?, page?, limit? | Paginated entries |
| `customer-ledger:get` | id | Entry |
| `customer-ledger:create-multi-item` | customerData, saleData | Ledger entry (auto-creates customer) |
| `customer-ledger:update-multi-item` | id, customerId, saleData | Ledger entry |
| `customer-ledger:delete` | id | `{ success }` (cascades, restores stock) |
| `customer-ledger:pending` | customerId | Entries |
| `customer-ledger:link-to-invoice` | entryIds[], invoiceId | `{ success }` |

**Vendor Invoices** (`vendorInvoiceIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `vendor-invoices:list` | status?, vendorId?, dateFrom?, dateTo?, page?, limit? | Paginated invoices |
| `vendor-invoices:get` | id | Invoice |
| `vendor-invoices:get-with-items` | id | Invoice + items |
| `vendor-invoices:create` | vendorId, invoiceNumber, issueDate, dueDate, subtotal, tax, discount, total, paidAmount, notes?, items[] | Invoice + items |
| `vendor-invoices:update` | id, vendorId, invoiceNumber, ... | Invoice |
| `vendor-invoices:replace-items` | id, items[] | Invoice + items |
| `vendor-invoices:delete` | id | `{ success }` |
| `vendor-invoices:mark-paid` | id | Invoice |
| `vendor-invoices:summary` | — | Aggregated totals |

**Customer Invoices** (`invoiceIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `invoices:list` | status?, customerId?, dateFrom?, dateTo?, page?, limit? | Paginated invoices |
| `invoices:get` | id | Invoice |
| `invoices:get-with-items` | id | Invoice + items |
| `invoices:create` | customerId, invoiceNumber, issueDate, dueDate, subtotal, tax, discount, total, paidAmount, notes?, items[] | Invoice + items (validates stock) |
| `invoices:update` | id, customerId, invoiceNumber, ... | Invoice |
| `invoices:replace-items` | id, items[] | Invoice + items |
| `invoices:delete` | id | `{ success }` |
| `invoices:mark-paid` | id | Invoice |
| `invoices:summary` | — | Aggregated totals |

**Expenses** (`expenseIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `expense-categories:list` | — | Categories |
| `expense-categories:create` | name | Category |
| `expense-categories:update` | id, name | Category |
| `expense-categories:delete` | id | `{ success }` |
| `expenses:list` | categoryId?, month?, page?, limit? | Paginated expenses |
| `expenses:create` | categoryId, datetime, amount, desc? | Expense |
| `expenses:update` | id, categoryId, datetime, amount, desc? | Expense |
| `expenses:delete` | id | `{ success }` |
| `expenses:monthly` | — | Monthly grouped totals |

**Day Closing** (`dayClosingIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `day-closing:list` | page?, limit? | Paginated reports |
| `day-closing:get` | date | Report |
| `day-closing:generate` | businessDate | `{ report, updated }` |
| `day-closing:get-export-dir` | — | string or null |
| `day-closing:choose-export-dir` | — | `{ success, path }` or `{ canceled }` (opens native directory picker) |
| `day-closing:export-excel` | businessDate | `{ success, path }` (ExcelJS styled report with sales, purchases, expenses) |

**Dashboard** (`dashboardIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `dashboard:stats` | threshold?, period?, startDate?, endDate? | Aggregated stats, recent transactions, low stock items |

**Database Management** (`dbIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `db:export` | destDir? | `{ success, path }` |
| `db:select-export-path` | — | `{ path }` or `{ canceled }` |
| `db:import` | — | `{ success, path }` |
| `db:nuke` | — | `{ success }` |
| `db:open-sync-log-dir` | — | void |

**Sync** (`syncIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `sync:run` | — | `SyncResult` (push + pull, up to 3 retries) |
| `sync:pull` | — | `SyncResult` |
| `sync:last-time` | — | string or null |

**Main → Renderer events:**

| Channel | Description |
|---------|-------------|
| `sync:progress` | Progress updates during sync (phase, table, attempt) |

**Audit Log** (`auditLogIpc.ts`):

| Channel | Parameters | Returns |
|---------|-----------|---------|
| `audit-log:list` | page?, limit? | Paginated audit entries |

## Auth

- Single owner account, seeded from `.env` variables or defaults (`owner@pos.com` / `owner123`)
- Passwords hashed with bcryptjs (10 salt rounds)
- Email domains restricted to 15 whitelisted providers
- Login via `auth:login` IPC, returns user object to `AuthContext`
- `ProtectedRoute` wraps all pages except `/login`
- User stored in React state (in-memory), lost on app restart (re-login required)
- No session tokens or JWT — auth is purely in-memory

### Auth Flow

1. First launch: `database.ts:seedOwner()` creates owner from `.env` (or defaults)
2. `auth:owner-status` → checks if owner exists → determines login vs register UI
3. `auth:login` → validates credentials with bcrypt → returns user object
4. `AuthContext` stores user in React state → `ProtectedRoute` checks it

## Routing

All routes use `HashRouter`. Protected routes wrapped in `ProtectedRoute → Layout → Page`.

| Path | Page | Description |
|------|------|-------------|
| `/login` | LoginPage | Email/password login + registration |
| `/dashboard` | Dashboard | KPIs, charts, recent transactions, low stock |
| `/vendors` | VendorsPage | Vendor CRUD + outstanding balances |
| `/customers` | CustomersPage | Customer CRUD + outstanding balances |
| `/inventory` | InventoryPage | Product management + stock tracking |
| `/vendor-ledger` | VendorLedgerPage | Purchase transaction records |
| `/customer-ledger` | CustomerLedgerPage | Sales transaction records |
| `/invoices` | InvoicesPage | Customer invoices (receivables) |
| `/vendor-invoices` | VendorInvoicesPage | Vendor invoices (payables) |
| `/expenses` | ExpensesPage | Expense tracking by category |
| `/day-closing` | DayClosingPage | End-of-day reports + Excel export |
| `/settings` | SettingsPage | DB backup/restore, sync, nuke |
| `/backup-logs` | BackupLogsPage | Audit log viewer |
| `*` | Redirect → `/dashboard` | Catch-all |

> Note: `OrdersPage.tsx` and `ProductsView.tsx` exist as files but are **not wired into the router**.

## Window Config

- Size: 1280×800
- Custom titlebar in packaged builds (`frame: false`, `titleBarStyle: 'hidden'`)
- Window controls via IPC: `window:minimize`, `window:maximize`, `window:close`

## Key Features

### Vendor Management
CRUD + outstanding balance calculation + cascade soft delete (reverses inventory stock).

### Customer Management
CRUD + outstanding balance calculation + cascade soft delete.

### Inventory / Products
Product catalog with 47 unit types, stock adjustment, low stock alerts (configurable threshold), stock validation on sales (prevents overselling).

### Vendor Ledger (Purchases)
Multi-item purchase entries linked to vendors. Auto-creates vendor_invoices + vendor_invoice_items. Auto-increments inventory stock. Supports "create with new vendor" atomic operation. Update/delete with inventory stock reversal.

### Customer Ledger (Sales)
Multi-item sale entries linked to customers. Auto-creates invoices + invoice_items. Auto-decrements inventory stock (with insufficient stock validation). Can create new customer on-the-fly during sale.

### Invoicing (Customer)
Full lifecycle: Pending → Paid/Overdue/Cancelled. Subtotal, tax, discount, total. Line items from inventory. Mark-as-paid. Summary dashboard.

### Vendor Invoicing
Mirrors customer invoicing for purchase side. Link ledger entries to existing invoices.

### Expense Management
Categories (CRUD) + expense entries + monthly aggregation + category filtering.

### Day Closing / Reports
Auto-generates daily financial summary (sales, purchases, expenses). ExcelJS-based export with styled reports: color-coded sections, summary cards, per-transaction detail. Configurable export directory.

### Dashboard
KPI cards, period-based stats (day/month/year/custom), invoice status counts, recent transactions, low stock items.

### Cloud Sync (Turso)
Bidirectional sync (local SQLite ↔ Turso). Push: uploads unsynced rows. Pull: downloads rows since last sync. Retry with exponential backoff. Progress reporting to UI. Sync metadata tracking. Error logging.

### Database Backup & Restore
Export to desktop (timestamped, auto-cleans old backups). Import from .db file. Database nuke (full reset). Audit logging for all operations.

### Audit Logging
Tracks sync, pull, export, import, nuke operations. Records action, status, user, details, timestamp.

### UI Features
Dark/light mode (localStorage persisted), custom titlebar, collapsible sidebar, in-app notifications (sync status), toast notifications (react-hot-toast), search inputs, pagination, data tables, modals, date pickers, analytics charts, donut charts, KPI rows.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts Vite + Electron in parallel |
| `npm run build` | TypeScript compile + Vite build |
| `npm run dist:win` | Build + package for Windows |
| `npm run dist:mac` | Build + package for macOS (ARM64) |
| `npm run dist:linux` | Build + package for Linux |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |
| `npm run transpile:electron` | Compile electron TS only |
| `npm run seed:owner` | Seed owner account |
| `npm run seed:owner:force` | Force re-seed owner |
| `npm run seed:test-data` | Seed test data |

## Git History

| Commit | Summary |
|--------|---------|
| `1f6c791` | Day closing report Excel export feature added (ExcelJS) |
| `705308f` | Customer and vendor ledger repository bug fixes |
| `d5ddb4c` | Milestone achieved |
| `20cfdb9` | Vendor ledger and invoice generation refactored and tested |
| `152a8b8` | Milestone |
| `1fde01d` | Milestone |
| `7e8ddd9` | POS core completed |
| `ec53105` | Database and UI synced |
| `44b4980` | UI fixes (round 2) |
| `b26d1e3` | UI fixes |
| `c0beaa5` | Initial project setup |
