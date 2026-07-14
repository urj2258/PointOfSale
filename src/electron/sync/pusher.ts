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

function getFkColumns(db: Database.Database, table: string): string[] {
  const fks = db.prepare(`PRAGMA foreign_key_list(${table})`).all() as { from: string; table: string; to: string }[];
  return fks.map(f => `${f.from} → ${f.table}(${f.to})`);
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

    const fkInfo = getFkColumns(db, table);
    if (fkInfo.length > 0) {
      console.log(`[pusher] ${table} FKs: ${fkInfo.join(', ')}`);
    }

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
        const fkCols = allCols.filter(c => c !== 'id' && c !== 'synced' && c !== 'created_at' && c !== 'updated_at' && c !== 'deleted_at');
        const fkValues = fkCols.map(c => `${c}=${row[c]}`).join(', ');
        console.error(`[pusher] failed to push row ${row.id} in ${table} (${fkValues}):`, err);
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

export async function pushAll(tables: string[], onTableStart?: (table: string, index: number) => void): Promise<PushResult[]> {
  const results: PushResult[] = [];

  for (let i = 0; i < tables.length; i++) {
    onTableStart?.(tables[i], i);
    results.push(await pushTable(tables[i]));
  }

  return results;
}
