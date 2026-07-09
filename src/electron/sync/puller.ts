import { getDatabase } from '../database.js';
import { getTursoClient } from './tursoClient.js';
import type Database from 'better-sqlite3';

export interface FailedDetail {
  id: string;
  error: string;
}

export interface PullResult {
  table: string;
  pulled: number;
  skipped: number;
  failed: number;
  failedDetails?: FailedDetail[];
  error?: string;
}

function getColumnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
    .map(c => c.name);
}

async function pullTable(table: string, lastSyncTime: string): Promise<PullResult> {
  const db = getDatabase();
  const turso = getTursoClient();
  const result: PullResult = { table, pulled: 0, skipped: 0, failed: 0 };

  try {
    const remoteResult = await turso.execute({
      sql: `SELECT * FROM ${table} WHERE updated_at > ?`,
      args: [lastSyncTime],
    });

    const rows = remoteResult.rows as Record<string, unknown>[];
    if (rows.length === 0) return result;

    const allCols = getColumnNames(db, table);
    const colNames = allCols.join(', ');
    const placeholders = allCols.map(() => '?').join(', ');

    const upsertSql = `INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`;

    for (const row of rows) {
      try {
        const id = row.id as string;

        const local = db.prepare(`SELECT updated_at FROM ${table} WHERE id = ?`).get(id) as { updated_at: string } | undefined;
        if (local && local.updated_at >= (row.updated_at as string)) {
          result.skipped++;
          continue;
        }

        const args = allCols.map(c => row[c] as (string | number | null));
        db.prepare(upsertSql).run(...args);
        result.pulled++;
      } catch (err) {
        console.error(`[puller] failed to pull row ${row.id} in ${table}:`, err);
        if (!result.failedDetails) result.failedDetails = [];
        result.failedDetails.push({ id: row.id as string, error: String(err) });
        result.failed++;
      }
    }
  } catch (err) {
    console.error(`[puller] failed to process table ${table}:`, err);
    result.error = String(err);
    result.failed = -1;
  }

  return result;
}

export async function pullAll(tables: string[], lastSyncTime: string): Promise<PullResult[]> {
  const results: PullResult[] = [];
  for (const table of tables) {
    results.push(await pullTable(table, lastSyncTime));
  }
  return results;
}
