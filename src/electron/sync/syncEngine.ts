import { pushAll } from './pusher.js';
import type { PushResult } from './pusher.js';
import { pullAll } from './puller.js';
import type { PullResult } from './puller.js';
import { SYNC_TABLE_ORDER, getDatabase, getDbPath } from '../database.js';
import { getTursoClient } from './tursoClient.js';
import fs from 'fs';
import path from 'path';

export interface SyncProgress {
  phase: 'push' | 'pull' | 'retry' | 'done';
  currentTable: string;
  tableIndex: number;
  totalTables: number;
  attempt: number;
  maxAttempts: number;
}

export interface SyncResult {
  success: boolean;
  pushResults: PushResult[];
  pullResults: PullResult[];
  syncedAt: string;
  attempts: number;
}

function getDataDir(): string {
  return path.dirname(getDbPath());
}

function getSyncMetaPath(): string {
  return path.join(getDataDir(), 'sync-meta.json');
}

export function readLastSyncTime(): string | null {
  try {
    const raw = fs.readFileSync(getSyncMetaPath(), 'utf-8');
    const data = JSON.parse(raw);
    return typeof data.last_sync_time === 'string' ? data.last_sync_time : null;
  } catch {
    return null;
  }
}

function writeLastSyncTime(timestamp: string): void {
  const dir = path.dirname(getSyncMetaPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getSyncMetaPath(), JSON.stringify({ last_sync_time: timestamp }), 'utf-8');
}

export function clearSyncMeta(): void {
  try {
    if (fs.existsSync(getSyncMetaPath())) {
      fs.unlinkSync(getSyncMetaPath());
    }
  } catch { /* ignore */ }
}

/**
 * Conflict policy: last-write-wins by updated_at. Single-device-at-a-time
 * usage assumed. If the same row is edited on two devices before either
 * syncs, the later edit (by updated_at) silently overwrites the earlier
 * one. Sync before switching devices to avoid data loss.
 */
function getErrorLogPath(): string {
  return path.join(getDataDir(), 'sync-errors.log');
}

function appendErrorLog(data: { timestamp: string; attempt: number; pushResults: PushResult[]; pullResults: PullResult[] }): void {
  try {
    const line = JSON.stringify(data) + '\n';
    fs.appendFileSync(getErrorLogPath(), line, 'utf-8');
  } catch { /* ignore */ }
}

const MAX_SYNC_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runSync(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  const db = getDatabase();
  const turso = getTursoClient();

  try {
    db.pragma('foreign_keys = OFF');
    await turso.execute({ sql: 'PRAGMA foreign_keys = OFF', args: [] });
  } catch { /* best effort */ }

  try {
    for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        onProgress?.({ phase: 'retry', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 2);
        await sleep(delay);
      }

      const pushResults = await pushAll(SYNC_TABLE_ORDER, (table, index) => {
        onProgress?.({ phase: 'push', currentTable: table, tableIndex: index, totalTables: SYNC_TABLE_ORDER.length, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
      });

      const hasFatalError = pushResults.some(r => r.error !== undefined);
      const hasRowFailures = pushResults.some(r => r.failed > 0);

      if (!hasFatalError && !hasRowFailures) {
        writeLastSyncTime(syncedAt);
        onProgress?.({ phase: 'done', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
        return { success: true, pushResults, pullResults: [], syncedAt, attempts: attempt };
      }

      appendErrorLog({ timestamp: new Date().toISOString(), attempt, pushResults, pullResults: [] });

      if (hasFatalError) {
        if (attempt < MAX_SYNC_ATTEMPTS) continue;
        onProgress?.({ phase: 'done', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
        return { success: false, pushResults, pullResults: [], syncedAt, attempts: attempt };
      }

      writeLastSyncTime(syncedAt);
      onProgress?.({ phase: 'done', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
      return { success: false, pushResults, pullResults: [], syncedAt, attempts: attempt };
    }

    return { success: false, pushResults: [], pullResults: [], syncedAt, attempts: MAX_SYNC_ATTEMPTS };
  } finally {
    try {
      db.pragma('foreign_keys = ON');
      await turso.execute({ sql: 'PRAGMA foreign_keys = ON', args: [] });
    } catch { /* best effort */ }
  }
}

function isFreshDatabase(): boolean {
  try {
    const db = getDatabase();
    const coreTables = ['vendors', 'customers', 'inventory', 'vendor_ledger', 'vendor_invoices', 'vendor_invoice_items', 'customer_ledger', 'invoices', 'invoice_items', 'expenses', 'day_closing_reports'];
    for (const table of coreTables) {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
      if (count > 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveLastSyncTime(): string {
  if (isFreshDatabase()) return '1970-01-01T00:00:00.000Z';
  return readLastSyncTime() ?? '1970-01-01T00:00:00.000Z';
}

export async function runPullOnly(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  const lastSyncTime = resolveLastSyncTime();
  const db = getDatabase();
  const turso = getTursoClient();

  try {
    db.pragma('foreign_keys = OFF');
    await turso.execute({ sql: 'PRAGMA foreign_keys = OFF', args: [] });
  } catch { /* best effort */ }

  try {
    for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        onProgress?.({ phase: 'retry', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 2);
        await sleep(delay);
      }

      const pullResults = await pullAll(SYNC_TABLE_ORDER, lastSyncTime, (table, index) => {
        onProgress?.({ phase: 'pull', currentTable: table, tableIndex: index, totalTables: SYNC_TABLE_ORDER.length, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
      });

      const hasFatalError = pullResults.some(r => r.error !== undefined);
      const hasRowFailures = pullResults.some(r => r.failed > 0);

      if (!hasFatalError && !hasRowFailures) {
        writeLastSyncTime(syncedAt);
        onProgress?.({ phase: 'done', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
        return { success: true, pushResults: [], pullResults, syncedAt, attempts: attempt };
      }

      appendErrorLog({ timestamp: new Date().toISOString(), attempt, pushResults: [], pullResults });

      if (hasFatalError) {
        if (attempt < MAX_SYNC_ATTEMPTS) continue;
        onProgress?.({ phase: 'done', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
        return { success: false, pushResults: [], pullResults, syncedAt, attempts: attempt };
      }

      writeLastSyncTime(syncedAt);
      onProgress?.({ phase: 'done', currentTable: '', tableIndex: 0, totalTables: 0, attempt, maxAttempts: MAX_SYNC_ATTEMPTS });
      return { success: false, pushResults: [], pullResults, syncedAt, attempts: attempt };
    }

    return { success: false, pushResults: [], pullResults: [], syncedAt, attempts: MAX_SYNC_ATTEMPTS };
  } finally {
    try {
      db.pragma('foreign_keys = ON');
      await turso.execute({ sql: 'PRAGMA foreign_keys = ON', args: [] });
    } catch { /* best effort */ }
  }
}
