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
│   │   │   ├── dbIpc.ts
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
│   │       ├── tursoClient.ts
│   │       ├── pusher.ts
│   │       ├── puller.ts
│   │       ├── syncEngine.ts
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

## Function Reference

### Electron Main Process

#### `electron/main.ts`
| Function | Description |
|----------|-------------|
| `createWindow()` | Creates BrowserWindow (1280×800), sets preload, loads Vite dev URL or production build, hides frame in packaged mode |
| `ipcMain.on('window:minimize')` | Minimizes the window |
| `ipcMain.on('window:maximize')` | Toggles maximize/unmaximize |
| `ipcMain.on('window:close')` | Closes the window |
| `app.whenReady().then(...)` | Inits DB, registers all IPC handlers, creates window |
| `app.on('before-quit')` | Closes the database connection |

#### `electron/preload.cts`
| Function | Description |
|----------|-------------|
| `contextBridge.exposeInMainWorld('electron', ...)` | Exposes typed IPC methods to renderer: window controls, vendors, customers, inventory, vendorLedger, customerLedger, vendorInvoices, invoices, expenseCategories, expenses, dayClosing, dashboard, auth, sync, db, auditLog |

#### `electron/database.ts`
| Function | Description |
|----------|-------------|
| `loadEnv()` | Loads .env from resourcesPath (packaged) or CWD (dev) |
| `getDbPath()` | Returns `D:\pos-data\pos.db` |
| `initDatabase()` | Opens SQLite (WAL mode, FK ON), runs createTables → migrateSchema → createIndexes → seedOwner → seedExtraUsers |
| `getDatabase()` | Returns the singleton Database instance (throws if not init'd) |
| `closeDatabase()` | Closes the database connection and nulls the reference |
| `createTables(db)` | Creates all 12 tables (vendors, customers, inventory, vendor_ledger, vendor_invoices, vendor_invoice_items, customer_ledger, invoices, invoice_items, expense_categories, expenses, day_closing_reports, users, audit_logs) with CHECK constraints and FKs |
| `migrateSchema(db)` | Handles schema evolution: renames misnamed columns (delted_at→deleted_at, sycned→synced), adds missing columns, migrates vendor_ledger/customer_ledger from legacy product_id schema to invoice-linked schema, recreates audit_logs with updated CHECK constraints |
| `createIndexes(db)` | Creates performance indexes on synced, deleted_at, vendor_id, customer_id, transaction_datetime, issue_date, due_date, status, invoice_id, product_id, business_date, and action columns |
| `seedOwner(db)` | Creates default owner account from env vars (OWNER_EMAIL, OWNER_PASSWORD, etc.) or defaults to owner@pos.com/owner123. Skips if any user exists |
| `seedExtraUsers(db)` | Seeds additional users (e.g. awais@gmail.com) if they don't exist |

#### `electron/dbHelpers.ts`
| Function | Description |
|----------|-------------|
| `updateRow(db, table, id, fields)` | Sets updated_at and synced=0, then runs a dynamic UPDATE with the provided fields. Throws if synced or updated_at are directly set |
| `softDeleteRow(db, table, id)` | Sets deleted_at, updated_at, and synced=0 for the given row |

#### `electron/pathResolver.ts`
| Function | Description |
|----------|-------------|
| `getPreloadPath()` | Resolves the path to dist-electron/preload.cjs based on isDev() mode |

#### `electron/utils.ts`
| Function | Description |
|----------|-------------|
| `isDev()` | Returns true if NODE_ENV === 'development' |

#### `electron/validation.ts`
| Function | Description |
|----------|-------------|
| `ValidationError` | Custom error class for validation failures |
| `handleIpcError(err)` | Returns `{ error: message }` object for IPC error responses |
| `isString(v)` | Type guard: checks typeof === 'string' |
| `isNonEmptyString(v)` | Type guard: string with trimmed length > 0 |
| `isNumber(v)` | Type guard: typeof === 'number' and finite |
| `isPositiveNumber(v)` | Type guard: number > 0 |
| `isNonNegativeNumber(v)` | Type guard: number >= 0 |
| `isEmail(v)` | Regex check for basic email format |
| `isAllowedEmailDomain(v)` | Checks email domain against 15 whitelisted providers (gmail, outlook, yahoo, etc.) |
| `isPhone(v)` | Validates Pakistani phone numbers (03xx, 92 3xx, landline formats with/without dashes/spaces) |
| `isName(v)` | 3-100 chars, not purely digits or special chars |
| `isAddress(v)` | 5-250 chars, not purely digits or special chars |
| `isAllowedUnit(v)` | Checks against 47 allowed unit types (kg, liter, bag, etc.) |
| `isProductName(v)` | 3-100 chars, not purely digits or special chars |
| `isNonNegativeInteger(v)` | Type guard: integer >= 0 |
| `isDescription(v)` | 5-500 chars, not purely digits or special chars |
| `isValidDateString(v)` | Checks if `new Date(value)` is valid |
| `isUUID(v)` | Regex check for UUID v4 format |
| `isUndefinedOrString(v)` | True if undefined, null, or string |
| `assert(condition, msg)` | Assertion that throws ValidationError |
| `assertNonEmptyString(v, field)` | Assert non-empty string |
| `assertNumber(v, field)` | Assert valid number |
| `assertPositiveNumber(v, field)` | Assert number > 0 |
| `assertNonNegativeNumber(v, field)` | Assert number >= 0 |
| `assertEmail(v, field)` | Assert valid email + allowed domain |
| `assertPhone(v, field)` | Assert valid Pakistani phone |
| `assertName(v, field)` | Assert valid name |
| `assertAddress(v, field)` | Assert valid address |
| `assertProductName(v, field)` | Assert valid product name |
| `assertAllowedUnit(v, field)` | Assert valid unit type |
| `assertNonNegativeInteger(v, field)` | Assert integer >= 0 |
| `assertInteger(v, field)` | Assert non-zero integer |
| `assertDescription(v, field)` | Assert valid description |
| `assertOptionalString(v, field)` | Assert undefined or string |
| `assertValidDateString(v, field)` | Assert valid date string |
| `assertUUID(v, field)` | Assert valid UUID |

#### `electron/seed-cli.ts`
| Function | Description |
|----------|-------------|
| Top-level script | CLI tool (`npm run seed:owner`). If SEED_FORCE=true, deletes all users and creates owner from env vars. Else checks if owner exists. Exits process after completion |

#### `electron/seed-test-data.ts`
| Function | Description |
|----------|-------------|
| Top-level script | Clears all business tables and re-seeds with sample data: 2 expense categories, owner, 2 vendors, 2 customers, 3 inventory items, 2 vendor ledger entries, 2 customer ledger entries, 2 vendor invoices with items, 2 invoices with items, 2 expenses, 2 day closing reports |

### IPC Handlers

#### `electron/ipc/index.ts`
| Function | Description |
|----------|-------------|
| `registerAllIpcHandlers()` | Calls all 14 IPC registration functions to wire up ipcMain.handle() for every channel |

#### `electron/ipc/authIpc.ts`
| Function | Description |
|----------|-------------|
| `registerAuthIpc()` | Registers auth:login (validates email/password → loginUser), auth:register (validates → registerOwner), auth:owner-status (→ getOwnerStatus) |

#### `electron/ipc/syncIpc.ts`
| Function | Description |
|----------|-------------|
| `sendProgress(event, progress)` | Sends sync:progress IPC event to the renderer via BrowserWindow.webContents |
| `registerSyncIpc()` | Registers sync:run (→ runSync with progress), sync:pull (→ runPullOnly), sync:last-time (→ readLastSyncTime). Logs audit entries for sync/pull results |

#### `electron/ipc/dbIpc.ts`
| Function | Description |
|----------|-------------|
| `registerDbIpc()` | Registers: db:export (copies DB to desktop with timestamp, cleans old backups, logs audit), db:select-export-path (native directory picker), db:import (native file picker, restores DB, resets sync), db:nuke (deletes DB + WAL + SHM + sync meta, re-initializes, logs audit), db:open-sync-log-dir (opens folder in explorer) |

#### `electron/ipc/vendorIpc.ts`
| Function | Description |
|----------|-------------|
| `registerVendorIpc()` | Registers vendors:list/get/create/update/delete/outstanding. All inputs validated before passing to vendorRepository |

#### `electron/ipc/customerIpc.ts`
| Function | Description |
|----------|-------------|
| `registerCustomerIpc()` | Registers customers:list/get/create/update/delete/outstanding. All inputs validated before passing to customerRepository |

#### `electron/ipc/inventoryIpc.ts`
| Function | Description |
|----------|-------------|
| `registerInventoryIpc()` | Registers inventory:list/get/create/update/adjust-stock/delete/low-stock-count. Validates product name, allowed unit, non-negative quantity, integer for stock change |

#### `electron/ipc/vendorLedgerIpc.ts`
| Function | Description |
|----------|-------------|
| `registerVendorLedgerIpc()` | Registers vendor-ledger:list/get/create/update/delete/pending/link-to-invoice/create-with-new-vendor/export-excel. Validates all fields including items array. Handles SQLITE_CONSTRAINT_CHECK for stock reversal errors. export-excel uses native directory picker if no export dir configured |

#### `electron/ipc/customerLedgerIpc.ts`
| Function | Description |
|----------|-------------|
| `registerCustomerLedgerIpc()` | Registers customer-ledger:list/get/create-multi-item/update-multi-item/delete/export-excel. Validates customer data (or new customer fields), sale items, amounts. Handles stock validation errors |

#### `electron/ipc/vendorInvoiceIpc.ts`
| Function | Description |
|----------|-------------|
| `registerVendorInvoiceIpc()` | Registers vendor-invoices:list/get/get-with-items/create/update/replace-items/delete/mark-paid/summary. Validates UUIDs for vendor ID, date strings, non-negative financial fields |

#### `electron/ipc/invoiceIpc.ts`
| Function | Description |
|----------|-------------|
| `registerInvoiceIpc()` | Registers invoices:list/get/get-with-items/create/update/replace-items/delete/mark-paid/summary. Identical pattern to vendorInvoiceIpc but for customer invoices. Handles stock validation during create |

#### `electron/ipc/expenseIpc.ts`
| Function | Description |
|----------|-------------|
| `registerExpenseIpc()` | Registers expense-categories:list/create/update/delete and expenses:list/create/update/delete/monthly |

#### `electron/ipc/dayClosingIpc.ts`
| Function | Description |
|----------|-------------|
| `registerDayClosingIpc()` | Registers day-closing:list/get/generate/get-export-dir/choose-export-dir/export-excel/export-summary-excel. Export uses native directory picker if no export dir configured |

#### `electron/ipc/dashboardIpc.ts`
| Function | Description |
|----------|-------------|
| `registerDashboardIpc()` | Registers dashboard:stats (threshold, period, startDate, endDate → getDashboardStats) |

#### `electron/ipc/auditLogIpc.ts`
| Function | Description |
|----------|-------------|
| `registerAuditLogIpc()` | Registers audit-log:list (page, limit → getAuditLogs) |

### Repositories (Data Access Layer)

#### `electron/repositories/authRepository.ts`
| Function | Description |
|----------|-------------|
| `loginUser(email, password)` | Finds user by email, compares bcrypt hash, returns user without password or null |
| `registerOwner(fullName, email, username, password)` | Creates first owner account (fails if any user exists), bcrypt hashes password |
| `getOwnerStatus()` | Returns `{ hasOwner: boolean }` |
| `getOwner()` | Returns `{ id, full_name }` of the first non-deleted user, or null |

#### `electron/repositories/vendorRepository.ts`
| Function | Description |
|----------|-------------|
| `getAllVendors(search?, page, limit)` | Paginated vendor list with optional name/phone search. Returns `{ data, total, page, limit }` |
| `getVendorById(id)` | Single vendor lookup |
| `createVendor(name, phone?, address?, mill_name?)` | Creates vendor with UUID, returns the created row |
| `insertVendorInTx(db, id, now, name, phone, address, mill_name?)` | Low-level insert for use within external transactions (no own transaction) |
| `updateVendor(id, name, phone?, address?, mill_name?)` | Updates vendor via updateRow helper |
| `softDeleteVendor(id)` | Cascading soft delete: reverses inventory stock for all linked ledger entries, soft-deletes ledger entries, soft-deletes vendor invoices + items, then soft-deletes vendor |
| `getVendorOutstanding(id)` | SUM of remaining_balance across non-deleted vendor_ledger entries |

#### `electron/repositories/customerRepository.ts`
| Function | Description |
|----------|-------------|
| `getAllCustomers(search?, page, limit)` | Paginated customer list with optional name/phone search |
| `getCustomerById(id)` | Single customer lookup |
| `createCustomer(name, phone?, address?, shop_name?)` | Creates customer with UUID |
| `insertCustomerInTx(db, id, now, name, phone, address, shop_name?)` | Low-level insert for use within external transactions |
| `updateCustomer(id, name, phone?, address?, shop_name?)` | Updates customer via updateRow |
| `softDeleteCustomer(id)` | Cascading soft delete: restores inventory stock for ledger entries, soft-deletes ledger, invoices + items, then customer |
| `getCustomerOutstanding(id)` | SUM of remaining_balance across non-deleted customer_ledger entries |

#### `electron/repositories/inventoryRepository.ts`
| Function | Description |
|----------|-------------|
| `getAllInventory(search?, page, limit, lowStock?, lowStockThreshold?)` | Paginated inventory list with optional name search and low-stock filter |
| `getInventoryById(id)` | Single item lookup |
| `createInventoryItem(name, unit, quantity, description?)` | Creates inventory item with UUID |
| `updateInventoryItem(id, name, unit, description?)` | Updates name/unit/description (not quantity — use adjustStock) |
| `adjustStock(id, quantityChange)` | Adds quantityChange to current stock (can be negative). Throws if result < 0 |
| `softDeleteInventoryItem(id)` | Soft-deletes inventory item |
| `getLowStockCount(threshold=10)` | Count of items with quantity <= threshold |

#### `electron/repositories/vendorLedgerRepository.ts`
| Function | Description |
|----------|-------------|
| `itemsAreEqual(oldItems, newItems)` | Compares item arrays by product_id and quantity for equality |
| `syncVendorInvoiceFromLedger(db, invoiceId, now)` | Recalculates vendor_invoice paid_amount, remaining_balance, and status from linked ledger entries |
| `getVendorLedgerEntries(vendorId?, dateFrom?, dateTo?, page, limit)` | Paginated vendor ledger with vendor name, invoice due date, and items JSON. Parses items_json into typed array |
| `getVendorLedgerById(id)` | Single entry with vendor name, due date, and items |
| `createVendorLedgerEntry(vendorId, datetime, items, totalPayment, paidAmount, desc?, vehicle?, dueDate?)` | Atomic transaction: creates vendor_invoice + invoice_items (updates stock up) + ledger entry |
| `createVendorWithPurchase(vendor, purchase)` | Atomic transaction: creates vendor row, then vendor_invoice + items + ledger in one transaction. Validates all inputs |
| `updateVendorLedgerEntry(id, vendorId, datetime, items, totalPayment, paidAmount, desc?, vehicle?, dueDate?)` | Updates ledger, compares old/new items — reverses old stock if changed, applies new stock, updates linked invoice total |
| `softDeleteVendorLedgerEntry(id)` | Cascading soft delete: reverses inventory stock, soft-deletes invoice items + invoice, then ledger entry |
| `getTodayVendorTotal()` | SUM of today's total_payment for dashboard |
| `getPendingVendorLedgerEntries(vendorId)` | Returns ledger entries not yet linked to any invoice |
| `linkEntriesToInvoice(entryIds[], invoiceId)` | Links multiple ledger entries to an existing invoice, recalculates invoice status |
| `exportVendorLedgerExcel(vendorId, fromDate?, toDate?, exportDir?)` | Generates styled ExcelJS workbook with vendor name, date range header, transaction rows, color-coded balances, and totals row. Returns buffer + filePath |

#### `electron/repositories/customerLedgerRepository.ts`
| Function | Description |
|----------|-------------|
| `itemsAreEqual(oldItems, newItems)` | Compares item arrays by product_id and quantity |
| `syncCustomerInvoiceFromLedger(db, invoiceId, now)` | Recalculates invoice paid_amount, remaining_balance, and status from linked ledger entries |
| `getCustomerLedgerEntries(customerId?, dateFrom?, dateTo?, page, limit)` | Paginated customer ledger with customer name, product name, quantity, rate, invoice due date |
| `getCustomerLedgerById(id)` | Single entry with customer name, product info, invoice due date |
| `createMultiItemSale(customer, sale)` | Atomic transaction: creates customer (if new), creates invoice + items (validates stock, deducts inventory), creates ledger entry. Throws on insufficient stock |
| `updateMultiItemSale(id, customerId, datetime, items, totalPayment, paidAmount, desc?, vehicle?, dueDate?)` | Updates ledger, reverses old stock, validates new stock, applies new stock, updates linked invoice |
| `softDeleteCustomerLedgerEntry(id)` | Cascading soft delete: restores inventory stock, soft-deletes invoice items + invoice, then ledger entry |
| `getTodayCustomerTotal()` | SUM of today's total_payment for dashboard |
| `getPendingCustomerLedgerEntries(customerId)` | Returns ledger entries not yet linked to any invoice |
| `linkEntriesToInvoice(entryIds[], invoiceId)` | Links multiple ledger entries to an invoice, recalculates invoice status |
| `exportCustomerLedgerExcel(customerId, fromDate?, toDate?, exportDir?)` | Generates styled ExcelJS workbook with customer name, date range, color-coded balances, totals. Identical style to vendor export |

#### `electron/repositories/vendorInvoiceRepository.ts`
| Function | Description |
|----------|-------------|
| `getAllVendorInvoices(status?, vendorId?, dateFrom?, dateTo?, page, limit)` | Paginated vendor invoices with vendor name, filtered by status/vendor/date range |
| `getVendorInvoiceById(id)` | Single vendor invoice with vendor name |
| `getVendorInvoiceItems(vendorInvoiceId)` | Invoice items with product name and unit, ordered by created_at |
| `getVendorInvoiceWithItems(id)` | Invoice + items combined |
| `createVendorInvoice(vendorId, invoiceNumber, issueDate, dueDate, subtotal, tax, discount, total, paidAmount, notes, items[])` | Atomic transaction: creates invoice + items (no stock change — stock is managed by ledger) |
| `updateVendorInvoice(id, ...)` | Updates invoice fields via updateRow |
| `replaceVendorInvoiceItems(invoiceId, items[])` | Atomic: soft-deletes old items, inserts new items |
| `markVendorInvoiceAsPaid(id)` | Sets paid_amount = total, remaining_balance = 0, status = 'Paid' |
| `softDeleteVendorInvoice(id)` | Soft-deletes invoice + its items |
| `getVendorInvoicesSummary()` | Returns `{ totalPayables, pendingTotal, overdueTotal, paidTotal }` |
| `getTodayVendorInvoiceTotal()` | SUM of today's invoice totals |

#### `electron/repositories/invoiceRepository.ts`
| Function | Description |
|----------|-------------|
| `getAllInvoices(status?, customerId?, dateFrom?, dateTo?, page, limit)` | Paginated customer invoices with customer name |
| `getInvoiceById(id)` | Single invoice with customer name |
| `getInvoiceItems(invoiceId)` | Invoice items with product name and unit |
| `getInvoiceWithItems(id)` | Invoice + items combined |
| `createInvoice(customerId, invoiceNumber, issueDate, dueDate, subtotal, tax, discount, total, paidAmount, notes, items[])` | Atomic transaction: validates stock for all items (throws if insufficient), creates invoice + items. Does NOT deduct stock (ledger handles that) |
| `insertInvoiceInTx(db, id, now, customerId, ...)` | Low-level insert for use within external transactions |
| `insertInvoiceItemInTx(db, id, now, invoiceId, productId, quantity, rate, total)` | Low-level insert for use within external transactions |
| `updateInvoice(id, ...)` | Updates invoice fields via updateRow |
| `replaceInvoiceItems(invoiceId, items[])` | Atomic: soft-deletes old items, inserts new items |
| `markInvoiceAsPaid(id)` | Sets paid_amount = total, remaining_balance = 0, status = 'Paid' |
| `softDeleteInvoice(id)` | Soft-deletes invoice + its items |
| `getInvoicesSummary()` | Returns `{ totalReceivables, pendingTotal, overdueTotal, paidTotal }` |
| `getTodayInvoiceTotal()` | SUM of today's invoice totals |

#### `electron/repositories/expenseRepository.ts`
| Function | Description |
|----------|-------------|
| `getAllExpenseCategories()` | Returns all non-deleted categories ordered by name |
| `createExpenseCategory(name)` | Creates category with UUID |
| `updateExpenseCategory(id, name)` | Updates category name, throws if not found |
| `deleteExpenseCategory(id)` | Atomic: soft-deletes all expenses in category, then soft-deletes category |
| `getExpenses(categoryId?, month?, page, limit)` | Paginated expenses with category name, filtered by category/month |
| `createExpense(categoryId, datetime, amount, description?)` | Creates expense entry |
| `getExpenseById(id)` | Single expense with category name |
| `updateExpense(id, categoryId, datetime, amount, description?)` | Updates expense via updateRow |
| `deleteExpense(id)` | Soft-deletes expense |
| `getTodayExpenseTotal()` | SUM of today's expenses for dashboard |
| `getMonthlyExpenses()` | Aggregated expenses grouped by month and category, ordered by month DESC |

#### `electron/repositories/dayClosingRepository.ts`
| Function | Description |
|----------|-------------|
| `getConfigPath()` | Returns path to export-config.json in userData |
| `getExportDir()` | Reads saved export directory from config file, or null |
| `setExportDir(dir)` | Saves export directory to config file |
| `getExportPath()` | Full path to DayClosing_Report.xlsx in export dir |
| `getSummaryExportPath(fromDate?, toDate?)` | Full path to DayClosing_Summary_*.xlsx with optional date range in filename |
| `getDayClosings(page, limit)` | Paginated list of all day closing reports ordered by business_date DESC |
| `getDayClosingByDate(date)` | Single report for a specific business date |
| `generateDayClosing(businessDate)` | Aggregates customer_ledger (sales), vendor_ledger (purchases), expenses for the date. Creates new report or updates existing. Returns `{ report, updated }` |
| `fmtDate(businessDate)` | Formats ISO date to "DD-Mon-YYYY" (e.g. "13-Jul-2026") |
| `exportDayClosingExcel(businessDate)` | Generates detailed ExcelJS report: title banner, summary cards (sales/purchases/expenses/net profit with color coding), per-transaction sales/purchases/expenses sections with totals. Appends as new worksheet in existing workbook or creates new |
| `exportDayClosingSummaryExcel(fromDate?, toDate?)` | Generates summary ExcelJS workbook: one row per day, grand totals, color-coded net profit. Filters by date range or exports all |

#### `electron/repositories/dashboardRepository.ts`
| Function | Description |
|----------|-------------|
| `computeDateRange(period, startDate?, endDate?)` | Returns `{ start, end }` ISO dates for 'day', 'month', 'year', or 'custom' period |
| `getDashboardStats(threshold, period, startDate?, endDate?)` | Returns: vendor/customer/inventory/lowStock counts, pending/overdue invoice counts, low stock items (top 10), date-filtered sales/purchases/expenses totals, invoice sales totals, recent transactions (last 10 sales + purchases) |

#### `electron/repositories/auditLogRepository.ts`
| Function | Description |
|----------|-------------|
| `createAuditLog(action, status, userId, userName, details?)` | Inserts audit entry silently (never throws). Tracks sync/pull/export/import/nuke actions |
| `getAuditLogs(page, limit)` | Paginated audit logs ordered by created_at DESC |

### Sync Engine

#### `electron/sync/tursoClient.ts`
| Function | Description |
|----------|-------------|
| `loadEnv()` | Loads .env from resourcesPath (packaged) or CWD (dev) |
| `requireEnv(name)` | Gets env var or throws descriptive error |
| `getTursoClient()` | Lazily creates and returns singleton Turso Client using TURSO_URL + TURSO_AUTH_TOKEN env vars |

#### `electron/sync/pusher.ts`
| Function | Description |
|----------|-------------|
| `getColumnNames(db, table)` | Gets column names from PRAGMA table_info |
| `getFkColumns(db, table)` | Gets FK references for debug logging |
| `pushTable(table)` | Reads rows where synced=0, upserts each to Turso via INSERT...ON CONFLICT, marks synced=1 on success. Logs FK info and individual row failures |
| `pushAll(tables, onTableStart?)` | Iterates tables in order, pushes each with progress callback. Returns array of PushResult per table |

#### `electron/sync/puller.ts`
| Function | Description |
|----------|-------------|
| `getColumnNames(db, table)` | Gets column names from PRAGMA table_info |
| `pullTable(table, lastSyncTime)` | SELECTs rows from Turso where updated_at > lastSyncTime, upserts locally via INSERT OR REPLACE. Skips rows where local updated_at >= remote updated_at |
| `pullAll(tables, lastSyncTime, onTableStart?)` | Iterates tables in order, pulls each with progress callback. Returns array of PullResult per table |

#### `electron/sync/syncEngine.ts`
| Function | Description |
|----------|-------------|
| `getDataDir()` | Directory containing the SQLite DB file |
| `getSyncMetaPath()` | Path to sync-meta.json in data dir |
| `readLastSyncTime()` | Reads last_sync_time from sync-meta.json, or null |
| `writeLastSyncTime(timestamp)` | Writes last_sync_time to sync-meta.json, creating directory if needed |
| `clearSyncMeta()` | Deletes sync-meta.json file |
| `getErrorLogPath()` | Path to sync-errors.log in data dir |
| `appendErrorLog(data)` | Appends JSON error log entry to sync-errors.log |
| `sleep(ms)` | Promise-based delay for retry backoff |
| `runSync(onProgress?)` | Full bidirectional sync: disables FKs, pushes tables in order with up to 3 retries (exponential backoff). On push success, writes last sync time. On fatal error with retries remaining, retries. On row failures (partial), writes last sync time but returns partial success. Re-enables FKs in finally |
| `isFreshDatabase()` | True if all core tables have 0 rows |
| `resolveLastSyncTime()` | Returns epoch (1970-01-01) for fresh databases, else readLastSyncTime() or epoch |
| `runPullOnly(onProgress?)` | Pull-only sync: resolves last sync time, pulls all tables with up to 3 retries. Same retry/error logic as runSync |

### UI (Renderer Process)

#### `ui/services/api.ts`
| Function | Description |
|----------|-------------|
| `api.vendors.*` | Typed wrappers for all vendor IPC channels |
| `api.customers.*` | Typed wrappers for all customer IPC channels |
| `api.inventory.*` | Typed wrappers for all inventory IPC channels |
| `api.vendorLedger.*` | Typed wrappers for all vendor ledger IPC channels |
| `api.customerLedger.*` | Typed wrappers for all customer ledger IPC channels |
| `api.vendorInvoices.*` | Typed wrappers for all vendor invoice IPC channels |
| `api.invoices.*` | Typed wrappers for all customer invoice IPC channels |
| `api.expenseCategories.*` | Typed wrappers for expense category IPC channels |
| `api.expenses.*` | Typed wrappers for expense IPC channels |
| `api.dayClosing.*` | Typed wrappers for day closing IPC channels |
| `api.dashboard.*` | Typed wrappers for dashboard IPC channels |
| `api.auth.*` | Typed wrappers for auth IPC channels |
| `api.sync.*` | Typed wrappers for sync IPC channels |
| `api.db.*` | Typed wrappers for database management IPC channels |
| `api.auditLog.*` | Typed wrappers for audit log IPC channels |

#### `ui/context/AuthContext.tsx`
| Function | Description |
|----------|-------------|
| `AuthProvider` | React context provider: checks owner status on mount via auth:owner-status, exposes currentUser, login (calls auth:login), logout, hasOwner, loading state |
| `useAuth()` | Hook to access AuthContext; throws if used outside provider |

#### `ui/context/DataContext.tsx`
| Function | Description |
|----------|-------------|
| `DataProvider` | Legacy mock data context: vendors, customers, invoices, expenses, inventory, transactions with add* functions |
| `useData()` | Hook to access DataContext |

#### `ui/context/NotificationContext.tsx`
| Function | Description |
|----------|-------------|
| `NotificationProvider` | In-app notification system: stores up to 50 notifications with type (sync_inactivity/failure/partial/success/general), title, description, timestamp. Provides addNotification, dismissNotification, clearNotification |
| `useNotifications()` | Hook to access NotificationContext |

#### `ui/hooks/useTheme.ts`
| Function | Description |
|----------|-------------|
| `applyTheme(isDark)` | Adds/removes 'dark' class on document.documentElement |
| `loadDarkMode()` | Reads dark_mode from localStorage, defaults to false |
| `saveDarkMode(isDark)` | Persists dark_mode to localStorage |
| `useTheme()` | Hook returning `{ isDarkMode, toggle, setDark }`. Applies theme and persists on change |

#### `ui/App.tsx`
| Function | Description |
|----------|-------------|
| `Layout` | Shell component: Sidebar + Titlebar + Header + main content area with Outlet |
| `App` | Root component: applies saved theme on mount, renders HashRouter Routes with ProtectedRoute wrapper for all business pages, catch-all redirect to /dashboard |

#### `ui/main.tsx`
| Function | Description |
|----------|-------------|
| Top-level | React entry point: mounts HashRouter > AuthProvider > DataProvider > NotificationProvider > App + Toaster |

### UI Components

#### `ui/components/Sidebar.tsx`
NavLink-based sidebar with collapsible menu, ThemeSwitch, Logo. Links to all business pages

#### `ui/components/Header.tsx`
Top header bar with menu toggle button, page title, notification bell, profile modal trigger

#### `ui/components/Titlebar.tsx`
Custom draggable titlebar for frameless window, shows only in packaged mode. Has window control buttons (min/max/close)

#### `ui/components/ProtectedRoute.tsx`
Auth guard: renders Outlet if currentUser exists, otherwise redirects to /login

#### `ui/components/Logo.tsx`
Configurable logo component reading from logoConfig.ts

#### `ui/components/ThemeSwitch.tsx`
Dark/light mode toggle using useTheme hook

#### `ui/components/NotificationModal.tsx`
Modal displaying in-app notifications from NotificationContext

#### `ui/components/PasswordInput.tsx`
Password input field with show/hide toggle

#### `ui/components/PosBackground.tsx`
Decorative POS-themed background component

#### `ui/components/ProductLedger.tsx`
Product-wise ledger view component for tracking inventory changes

#### `ui/components/AddRecordDrawer.tsx`
Slide-in drawer for adding new records (vendors, customers, etc.)

#### `ui/components/AnalyticsChart.tsx`
Reusable chart component for analytics visualization

#### `ui/components/CalendarModal.tsx`
Date picker/popup calendar modal

#### `ui/components/DonutGrid.tsx`
Donut chart grid for dashboard visualizations

#### `ui/components/KPIRow.tsx`
KPI (Key Performance Indicator) card row for dashboard

#### `ui/components/ProfileModal.tsx`
User profile modal showing account info

#### `ui/components/SummaryBreakdown.tsx`
Summary breakdown component with expandable sections

#### `ui/components/ui/ConfirmModal.tsx`
Generic confirmation dialog modal

#### `ui/components/ui/DataTable.tsx`
Generic data table component with sortable columns

#### `ui/components/ui/DateInput.tsx`
Date-only input component

#### `ui/components/ui/DateTimeInput.tsx`
Date + time input component

#### `ui/components/ui/Modal.tsx`
Generic modal dialog component

#### `ui/components/ui/Pagination.tsx`
Pagination controls component

#### `ui/components/ui/SearchInput.tsx`
Search input with debounce

#### `ui/components/views/BalanceSheet.tsx`
Balance sheet report view

#### `ui/components/views/BankAccountTransaction.tsx`
Bank account transaction view

#### `ui/components/views/CustomerDetails.tsx`
Customer details and history view

#### `ui/components/views/DayClosingReport.tsx`
Day closing report visualization view

#### `ui/components/views/ExpensesDetails.tsx`
Expenses detail breakdown view

#### `ui/components/views/InventoryReport.tsx`
Inventory status report view

#### `ui/components/views/InvoiceBills.tsx`
Invoice bill view for printing/display

#### `ui/components/views/ProfitLossReport.tsx`
Profit and loss report view

#### `ui/components/views/VendorDetails.tsx`
Vendor details and history view

### UI Pages

| Page | File | Description |
|------|------|-------------|
| LoginPage | `pages/LoginPage.tsx` | Email/password login + registration (if no owner exists) |
| Dashboard | `pages/Dashboard.tsx` | KPI cards, charts, recent transactions, low stock items |
| VendorsPage | `pages/vendors/VendorsPage.tsx` | Vendor list with CRUD and outstanding balances |
| VendorDetailPage | `pages/vendors/VendorDetailPage.tsx` | Single vendor detail view |
| CustomersPage | `pages/customers/CustomersPage.tsx` | Customer list with CRUD and outstanding balances |
| CustomerDetailPage | `pages/customers/CustomerDetailPage.tsx` | Single customer detail view |
| InventoryPage | `pages/inventory/InventoryPage.tsx` | Product management, stock tracking, adjustments |
| VendorLedgerPage | `pages/vendor-ledger/VendorLedgerPage.tsx` | Purchase transaction records, create/update/delete |
| CustomerLedgerPage | `pages/customer-ledger/CustomerLedgerPage.tsx` | Sales transaction records, create/update/delete |
| InvoicesPage | `pages/invoices/InvoicesPage.tsx` | Customer invoices CRUD with items |
| VendorInvoicesPage | `pages/vendor-invoices/VendorInvoicesPage.tsx` | Vendor invoices CRUD with items |
| ExpensesPage | `pages/expenses/ExpensesPage.tsx` | Expense tracking by category |
| DayClosingPage | `pages/day-closing/DayClosingPage.tsx` | End-of-day reports generation and Excel export |
| SettingsPage | `pages/settings/SettingsPage.tsx` | DB backup/restore, sync controls, nuke |
| BackupLogsPage | `pages/settings/BackupLogsPage.tsx` | Audit log viewer |
| OrdersPage | `pages/OrdersPage.tsx` | Exists but not wired into router |
| ProductsView | `pages/ProductsView.tsx` | Exists but not wired into router |

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
