import { getDatabase } from '../database.js';
import { getTursoClient } from './tursoClient.js';
import type Database from 'better-sqlite3';

export interface FailedDetail {
  id: string;
  error: string;
}

export interface PushResult {
  table: string;
  pushed: number;
  failed: number;
  failedDetails?: FailedDetail[];
  error?: string;
}

function getColumnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
    .map(c => c.name);
}

async function pushTable(table: string): Promise<PushResult> {
  const db = getDatabase();
  const turso = getTursoClient();
  const result: PushResult = { table, pushed: 0, failed: 0 };

  try {
    const rows = db.prepare(`SELECT * FROM ${table} WHERE synced = 0`).all() as Record<string, unknown>[];

    if (rows.length === 0) return result;

    const allCols = getColumnNames(db, table);
    const dataCols = allCols.filter(c => c !== 'id');
    const colNames = allCols.join(', ');
    const placeholders = allCols.map(() => '?').join(', ');
    const setClause = dataCols.map(c => `${c} = EXCLUDED.${c}`).join(', ');

    const upsertSql = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${setClause}`;

    for (const row of rows) {
      try {
        const cloudArgs = allCols.map(c => c === 'synced' ? 1 : row[c] as (string | number | null));
        await turso.execute({
          sql: upsertSql,
          args: cloudArgs,
        });

        db.prepare(`UPDATE ${table} SET synced = 1 WHERE id = ?`).run(row.id);
        result.pushed++;
      } catch (err) {
        console.error(`[pusher] failed to push row ${row.id} in ${table}:`, err);
        if (!result.failedDetails) result.failedDetails = [];
        result.failedDetails.push({ id: row.id as string, error: String(err) });
        result.failed++;
      }
    }
  } catch (err) {
    console.error(`[pusher] failed to process table ${table}:`, err);
    result.error = String(err);
    result.failed = -1;
  }

  return result;
}

export async function pushAll(tables: string[]): Promise<PushResult[]> {
  const results: PushResult[] = [];
  for (const table of tables) {
    results.push(await pushTable(table));
  }
  return results;
}
