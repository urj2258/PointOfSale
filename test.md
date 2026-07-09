# Sync / Backup Feature — Test Guide

## Prerequisites

1. Turso database created and schema applied
2. Environment variables set in `.env`

## Setup

### 1. Create Turso database

```bash
# Install Turso CLI if you haven't
npm install -g turso

# Login
turso auth login

# Create a database
turso db create pos-backup

# Get the connection URL
turso db show pos-backup --url
# → copy this as TURSO_URL in .env

# Create an auth token
turso db tokens create pos-backup
# → copy this as TURSO_AUTH_TOKEN in .env
```

### 2. Apply the schema to Turso

```bash
# Run the DDL against your Turso database
turso db shell pos-backup < src/electron/sync/turso-schema.sql
```

### 3. Verify `.env` has these values

```
TURSO_URL=libsql://pos-backup-<your-name>.turso.io
TURSO_AUTH_TOKEN=<your-token>
OWNER_EMAIL=owner@gmail.com
OWNER_PASSWORD=owner123
```

---

## How to Test

### Step 1 — Seed test data locally

```bash
npm run transpile:electron
node scripts/seed-test-data.js
```

This inserts 2 rows per table (1 already `synced`, 1 `synced = 0`). The unsynced rows will be pushed to Turso when you click Sync.

### Step 2 — Start the app

```bash
npm run dev
```

### Step 3 — Login

- **Email:** `owner@gmail.com`
- **Password:** `owner123`

### Step 4 — Navigate to Settings

Click the gear icon in the sidebar → **Settings**.

### Step 5 — Click "Sync Now"

The button will show "Syncing..." then display a result summary:

```
Pushed: 8    Pulled: 0    Synced at: 7/8/2026, 1:23:45 PM
Sync completed successfully.
```

- **8 pushed** = 1 unsynced row from each of the 8 data tables
- **0 pulled** = first sync, no remote changes yet

### Step 6 — Verify in Turso

```bash
turso db shell pos-backup "SELECT COUNT(*) as total FROM vendors;"
turso db shell pos-backup "SELECT id, name, synced FROM customers;"
turso db shell pos-backup "SELECT id, name, quantity FROM inventory;"
```

All tables should have the seeded rows. Every row should have `synced = 0` (Turso doesn't have the local `synced` column concept — but rows will exist).

### Step 7 — Pull-back test (simulate another device)

Manually insert a row into Turso with a newer `updated_at`:

```bash
turso db shell pos-backup "
INSERT INTO inventory (id, name, unit, quantity, description, created_at, updated_at, synced, deleted_at)
VALUES ('$(python3 -c "import uuid; print(uuid.uuid4())")', 'New Remote Item', 'pcs', 99, 'Added from another device', '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")', '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")', 0, NULL);
"
```

Then click **Sync Now** again. You should see:

```
Pushed: 0    Pulled: 1    Synced at: ...
```

The new inventory item should now appear in your local database.

### Step 8 — Check local DB after pull

```bash
sqlite3 D:\pos-data\pos.db "SELECT id, name, quantity, synced FROM inventory WHERE name = 'New Remote Item';"
```

Should show `synced = 1`.

---

## What Success Looks Like

| Scenario | Push | Pull | Result |
|---|---|---|---|
| First sync with unsynced local data | 8 | 0 | Cloud has all rows |
| Second sync (no changes) | 0 | 0 | Green "completed" |
| Remote row added in Turso | 0 | 1 | Local gets the row |
| Local edit after sync | 1+ | — | Row pushed again |
| Conflict (same row edited on both) | — | — | Later `updated_at` wins |

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `TURSO_URL environment variable is not set` | `.env` missing or not loaded | Check `.env` exists in `pos/` directory |
| `sync:run` IPC error in console | Electron modules not transpiled | Run `npm run transpile:electron` |
| `Pushed: 0` but you seeded data | Seed ran before `transpile:electron` | Re-run: `npm run transpile:electron && node scripts/seed-test-data.js` |
| `Failed: -1` for a table | Table doesn't exist on Turso side | Run `turso db shell pos-backup < turso-schema.sql` |
| Login fails | Wrong credentials or db path | Re-seed: `npm run seed:owner:force` |
