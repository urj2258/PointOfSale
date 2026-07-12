# Feature: Backup & Sync Audit Log

## Goal

Add an audit log that records every sync, pull, export, and import action performed by the user. Create a new "Backup Logs" page where these logs are displayed in a table.

---

## 1. Database Table

Add a new table `audit_logs` in `src/electron/database.ts` inside the `createTables` function (after the `users` table):

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('sync', 'pull', 'export', 'import')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Add an index in `createIndexes`:

```sql
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
```

---

## 2. Repository

Create `src/electron/repositories/auditLogRepository.ts`:

```ts
import { getDatabase } from '../database.js';

interface AuditLog {
  id: string;
  action: string;
  status: string;
  user_id: string;
  user_name: string;
  details: string | null;
  created_at: string;
}

export function createAuditLog(
  action: string,
  status: string,
  userId: string,
  userName: string,
  details?: string
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO audit_logs (id, action, status, user_id, user_name, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), action, status, userId, userName, details || null, new Date().toISOString());
}

export function getAuditLogs(page = 1, limit = 50): { logs: AuditLog[]; total: number } {
  const db = getDatabase();
  const offset = (page - 1) * limit;
  const total = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as AuditLog[];
  return { logs, total };
}
```

---

## 3. IPC Handler

Create `src/electron/ipc/auditLogIpc.ts`:

```ts
import { ipcMain } from 'electron';
import { getAuditLogs } from '../repositories/auditLogRepository.js';

export function registerAuditLogIpc() {
  ipcMain.handle('audit-log:list', (_e, page?: number, limit?: number) => {
    return getAuditLogs(page || 1, limit || 50);
  });
}
```

Register it in `src/electron/ipc/index.ts` — import `registerAuditLogIpc` and call it inside `registerAllIpcHandlers`.

---

## 4. Add IPC to preload / API

In `src/ui/services/api.ts`, add:

```ts
auditLog: {
  list: (page?: number, limit?: number) => e.auditLog.list(page, limit),
}
```

Also declare the type for `auditLog` in the `api` object's type signature (follow the same pattern as other endpoints in the file).

In `src/electron/preload.ts` (or wherever the `contextBridge` exposes methods), add:

```ts
auditLog: {
  list: (page?: number, limit?: number) => ipcRenderer.invoke('audit-log:list', page, limit),
}
```

---

## 5. Log Every Action

### 5a. Sync (`src/electron/ipc/syncIpc.ts`)

After `runSync()` returns, call `createAuditLog`:

```ts
import { createAuditLog } from '../repositories/auditLogRepository.js';
import { getCurrentUser } from '../repositories/authRepository.js'; // or however you get the logged-in user
```

Inside the `sync:run` handler, after getting the result:

```ts
const user = getCurrentUser(); // adjust based on how user session works
const status = result.success ? 'success' : (totalFailed > 0 ? 'partial' : 'failure');
const details = `Pushed: ${totalPushed}, Pulled: ${totalPulled}, Failed: ${totalFailed}`;
createAuditLog('sync', status, user.id, user.full_name, details);
```

Note: You need to figure out how to get the current logged-in user in the main process. Check `authRepository.ts` for a `getCurrentUser` or `getOwner` function. If one doesn't exist, you may need to store the user ID in a module-level variable when login succeeds, or pass it from the renderer via the IPC call.

### 5b. Pull (`src/electron/ipc/syncIpc.ts`)

Same pattern — after `runPullOnly()` returns:

```ts
const status = result.success ? 'success' : 'failure';
const details = `Pulled: ${totalPulled}, Failed: ${totalFailed}`;
createAuditLog('pull', status, user.id, user.full_name, details);
```

### 5c. Export (`src/electron/ipc/dbIpc.ts`)

After `fs.copyFileSync` succeeds or fails:

```ts
// on success
createAuditLog('export', 'success', user.id, user.full_name, `Exported to: ${destPath}`);

// on catch
createAuditLog('export', 'failure', user.id, user.full_name, String(err));
```

### 5d. Import (`src/electron/ipc/dbIpc.ts`)

After the import succeeds or fails:

```ts
// on success
createAuditLog('import', 'success', user.id, user.full_name, `Imported from: ${srcPath}`);

// on catch
createAuditLog('import', 'failure', user.id, user.full_name, String(err));
```

---

## 6. UI — Backup Logs Page

Create `src/ui/pages/settings/BackupLogsPage.tsx`.

This should be a new standalone page (not inside SettingsPage). Style it the same as other pages in the app (follow patterns from `DayClosingPage` or `ExpensesPage` for table + pagination).

The page should show a table with columns:

| Action | Status | User | Details | Date |
|--------|--------|------|---------|------|

- **Action**: sync / pull / export / import (format nicely, e.g. "Sync", "Pull", "Export", "Import")
- **Status**: success (green), failure (red), partial (amber)
- **User**: the user_name from the log
- **Details**: the details string
- **Date**: formatted from created_at

Add pagination at the bottom (50 per page).

---

## 7. Routing & Navigation

### Route

In `src/ui/App.tsx`, add a new route inside the `<Route element={<Layout />}>` block:

```tsx
<Route path="/backup-logs" element={<BackupLogsPage />} />
```

### Sidebar

In `src/ui/components/Sidebar.tsx`, add a new nav item:

```ts
{ label: 'Backup Logs', icon: 'file-text', to: '/backup-logs' }
```

Place it after the "Settings" item.

### Remove from SettingsPage

Remove the sync/pull/export/import buttons and all related UI from `SettingsPage.tsx`. Keep only the Account, Appearance, and Application sections in SettingsPage. The Backup Logs page will handle displaying results and history.

Actually — keep the action buttons in SettingsPage but remove the inline result display. The user clicks Sync/Pull/Export/Import in Settings, and the audit log records the result. The Backup Logs page is read-only history.

---

## Summary of Files to Create/Modify

| File | Action |
|------|--------|
| `src/electron/database.ts` | Add `audit_logs` table + index |
| `src/electron/repositories/auditLogRepository.ts` | **Create** — repository |
| `src/electron/ipc/auditLogIpc.ts` | **Create** — IPC handler |
| `src/electron/ipc/index.ts` | Register audit log IPC |
| `src/electron/ipc/syncIpc.ts` | Log sync + pull actions |
| `src/electron/ipc/dbIpc.ts` | Log export + import actions |
| `src/electron/preload.ts` | Expose auditLog API |
| `src/ui/services/api.ts` | Add auditLog API method |
| `src/ui/pages/settings/BackupLogsPage.tsx` | **Create** — logs table page |
| `src/ui/App.tsx` | Add route |
| `src/ui/components/Sidebar.tsx` | Add nav item |
