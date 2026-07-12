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
│   │   ├── pathResolver.ts        # Resolves preload path
│   │   ├── utils.ts               # isDev() helper
│   │   ├── validation.ts          # Input validators (email, phone, name, etc.)
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
│   └── ui/                        # Renderer process (React)
│       ├── main.tsx               # React entry, HashRouter
│       ├── App.tsx                # Routes + Layout
│       ├── index.css              # Tailwind base
│       ├── services/
│       │   └── api.ts             # Typed wrapper around window.electron
│       ├── context/
│       │   ├── AuthContext.tsx     # Login state, currentUser
│       │   ├── DataContext.tsx     # Mock data (legacy)
│       │   └── NotificationContext.tsx
│       ├── hooks/
│       │   └── useTheme.ts        # Dark mode toggle
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
│       │   └── views/             # Shared view components
│       └── pages/
│           ├── LoginPage.tsx
│           ├── Dashboard.tsx
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

## Sync Architecture

- **Push** (local → Turso): Iterates `SYNC_TABLE_ORDER`, inserts/updates rows where `synced = 0`
- **Pull** (Turso → local): Fetches rows newer than last sync time, upserts locally
- **Sync order** respects FK dependencies (vendors before vendor_ledger, etc.)
- **Last sync time** tracked in a metadata file

## IPC Pattern

Each domain has 3 files that must stay in sync:

| File | Role |
|------|------|
| `repositories/*.ts` | SQL queries, pure data access |
| `ipc/*.ts` | `ipcMain.handle('name:action', ...)` handlers |
| `preload.cts` | `ipcRenderer.invoke('name:action', ...)` bridge |
| `services/api.ts` | `window.electron.name.action(...)` typed wrapper |

To add a new IPC endpoint, you must touch all 4 files.

## Auth

- Single owner account, seeded from `.env` variables or defaults (`owner@pos.com` / `owner123`)
- Passwords hashed with bcryptjs
- Login via `auth:login` IPC, returns user object to `AuthContext`
- `ProtectedRoute` wraps all pages except `/login`
- User stored in React state (in-memory), lost on app restart (re-login required)

## Routing

All routes use `HashRouter`. Protected routes wrapped in `ProtectedRoute → Layout → Page`.

| Path | Page |
|------|------|
| `/login` | LoginPage |
| `/dashboard` | Dashboard |
| `/vendors` | VendorsPage |
| `/customers` | CustomersPage |
| `/inventory` | InventoryPage |
| `/vendor-ledger` | VendorLedgerPage |
| `/customer-ledger` | CustomerLedgerPage |
| `/invoices` | InvoicesPage |
| `/vendor-invoices` | VendorInvoicesPage |
| `/expenses` | ExpensesPage |
| `/day-closing` | DayClosingPage |
| `/settings` | SettingsPage |
| `/backup-logs` | BackupLogsPage |
| `*` | Redirects to `/dashboard` |

## Window Config

- Size: 1280×800
- Custom titlebar in packaged builds (`frame: false`, `titleBarStyle: 'hidden'`)
- Window controls via IPC: `window:minimize`, `window:maximize`, `window:close`

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts Vite + Electron in parallel |
| `npm run build` | TypeScript compile + Vite build |
| `npm run dist:win` | Build + package for Windows |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |
| `npm run transpile:electron` | Compile electron TS only |
