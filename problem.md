# Cloud Sync Approaches for the POS App

## Background

- **Current DB:** `better-sqlite3` — synchronous API, local file, WAL mode
- **Target:** Turso (libsql) — distributed SQLite with HTTP/WebSocket access
- **Schema:** 9 tables, all with `synced INTEGER DEFAULT 0`, `deleted_at`, `created_at`/`updated_at`
- **Helpers already built:** `updateRow()`, `softDeleteRow()` — auto-set `synced = 0`, `SYNC_TABLE_ORDER` documented

---

## Approach 1: Manual Push/Pull Sync Module (Recommended)

Keep `better-sqlite3` as the primary DB. Write a background sync loop that:
- **PUSH:** `SELECT * FROM <table> WHERE synced = 0 AND deleted_at IS NULL` → INSERT/UPSERT into Turso
- **PULL:** `SELECT * FROM <table> WHERE updated_at > last_sync_time` → upsert into local SQLite
- Mark rows as `synced = 1` after successful push
- Respect `SYNC_TABLE_ORDER` (parent rows first to avoid FK violations)

### Pros
- Works fully offline; local DB is always the source of truth
- No migration away from `better-sqlite3` needed
- Granular conflict control (last-write-wins by `updated_at`)
- Sync is explicit and auditable (`synced` flag)

### Cons
- Two DB engines to maintain
- Sync logic must handle edge cases (concurrent edits, deletions, network failures)
- Must track `updated_at` for incremental pull (already done)

### Effort: ~1 week

---

## Approach 2: Replace `better-sqlite3` with `@libsql/client` Entirely

Replace all direct `better-sqlite3` calls with `@libsql/client`. Turso's libsql is wire-compatible with SQLite, so SQL stays the same. The challenge is the **API difference**:

| better-sqlite3 | @libsql/client |
|---|---|
| `db.prepare(sql).run(...)` sync | `db.execute({ sql, args })` async |
| `db.prepare(sql).get(...)` sync | `db.execute({ sql, args })` → `rows[0]` |
| `db.transaction(fn)` sync | No built-in transaction helper; use `db.execute("BEGIN")` / `COMMIT` / `ROLLBACK` |
| `db.pragma(...)` | Not available (Turso handles settings) |
| `db.backup(...)` | Not available |

You'd need to:
1. Rewrite every repository function from sync to async
2. Update all IPC handlers to be async (`ipcMain.handle` already returns promises)
3. Update the React frontend to handle async data loading
4. Remove `dbHelpers.ts` `updateRow`/`softDeleteRow` since they're synchronous
5. Handle offline mode (libsql supports local replica, but adds complexity)

### Pros
- Single DB engine, simpler architecture
- Changes are immediately "in the cloud"
- No sync module to write

### Cons
- Cannot use Turso's free tier effectively (HTTP connections, limited DB size)
- Requires rewiring the entire data layer to async (every repo, every IPC handler)
- If internet goes down, app is crippled unless you add a local replica
- No `db.transaction()` equivalent makes multi-row operations harder

### Effort: ~2-3 weeks

---

## Approach 3: Hybrid — `better-sqlite3` Locally + Turso as Sync Target via Embedded Replica

libsql supports **embedded replicas** — a local file that syncs with the remote Turso DB automatically:

```ts
import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:pos.db',
  syncUrl: 'libsql://pos-cloud-username.turso.io',
  authToken: '...',
});

// This syncs in the background automatically
await db.sync();
```

### Pros
- Automatic sync — no manual push/pull logic
- Local file works offline; syncs when online
- libsql API is mostly compatible with SQLite

### Cons
- Still need to rewrite to async API
- Embedded replica is sync-only (local is read-only replica unless you use `libsql` with write support, which is experimental)
- If the replica is read-only, you can't write locally — defeats offline purpose
- Less mature than `better-sqlite3`

### Effort: ~2 weeks (plus risk of experimental features)

---

## Approach 4: Ditch Turso — Use Supabase (PostgreSQL) as Originally Planned

The prompt mentioned "future sync to a cloud Postgres (Supabase) database" at the top. If Turso is just an interim idea, consider going straight to Supabase:

- Supabase is **PostgreSQL**, not SQLite — schema is different (no `INTEGER`, use `BIGINT`; no `TEXT` PKs without indexing concerns; no `CHECK` constraints work the same way)
- You'd need two separate schemas and a translation layer
- Sync module becomes bidirectional with schema mapping
- Much heavier lift than Turso

### Pros
- Full-featured cloud DB (row-level security, real-time subscriptions, auth)
- The original design target

### Cons
- Schema mismatch = translation layer = complex
- No offline support without a local SQLite fallback
- Overkill for a single-owner POS app

### Effort: 3-4 weeks

---

## Recommendation

**Go with Approach 1** (manual push/pull sync module). Reasons:
- You already built the foundation (`synced` column, helpers, `SYNC_TABLE_ORDER`)
- `better-sqlite3` remains the primary DB — zero risk to existing functionality
- Offline-first is critical for a POS app (internet goes down in shops)
- The sync module can be a separate background process that runs periodically
- You can write it incrementally (start with push, add pull later)

The sync module structure would look like:

```
src/electron/
  sync/
    pusher.ts       — reads synced=0 rows, pushes to Turso
    puller.ts       — pulls newer rows from Turso, upserts locally
    syncEngine.ts   — orchestrates push/pull in correct table order
    tursoClient.ts  — shared @libsql/client connection
```
