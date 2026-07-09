import { pushAll } from './pusher.js';
import type { PushResult } from './pusher.js';
import { pullAll } from './puller.js';
import type { PullResult } from './puller.js';
import { SYNC_TABLE_ORDER, getDatabase } from '../database.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface SyncResult {
  success: boolean;
  pushResults: PushResult[];
  pullResults: PullResult[];
  syncedAt: string;
}

function getSyncMetaPath(): string {
  return path.join(app.getPath('userData'), 'sync-meta.json');
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

/**
 * Conflict policy: last-write-wins by updated_at. Single-device-at-a-time
 * usage assumed. If the same row is edited on two devices before either
 * syncs, the later edit (by updated_at) silently overwrites the earlier
 * one. Sync before switching devices to avoid data loss.
 */
export async function runSync(): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  const lastSyncTime = resolveLastSyncTime();

  const pushResults = await pushAll(SYNC_TABLE_ORDER);
  const pullResults = await pullAll(SYNC_TABLE_ORDER, lastSyncTime);

  const hasFatalError =
    pushResults.some(r => r.error !== undefined) ||
    pullResults.some(r => r.error !== undefined);

  if (!hasFatalError) {
    writeLastSyncTime(syncedAt);
  }

  return { success: !hasFatalError, pushResults, pullResults, syncedAt };
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

export async function runPullOnly(): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  const lastSyncTime = resolveLastSyncTime();

  const pullResults = await pullAll(SYNC_TABLE_ORDER, lastSyncTime);

  const hasFatalError = pullResults.some(r => r.error !== undefined);

  if (!hasFatalError) {
    writeLastSyncTime(syncedAt);
  }

  return { success: !hasFatalError, pushResults: [], pullResults, syncedAt };
}
