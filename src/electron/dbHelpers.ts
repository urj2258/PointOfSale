import type Database from 'better-sqlite3';

function nowISO(): string {
  return new Date().toISOString();
}

export function updateRow(
  db: Database.Database,
  table: string,
  id: string,
  fields: Record<string, unknown>,
): void {
  if ('synced' in fields) {
    throw new Error(`Cannot manually set synced — use updateRow() which sets it automatically`);
  }
  if ('updated_at' in fields) {
    throw new Error(`Cannot manually set updated_at — use updateRow() which sets it automatically`);
  }

  fields.updated_at = nowISO();
  fields.synced = 0;

  const setClause = Object.keys(fields)
    .map(k => `${k} = ?`)
    .join(', ');
  const values = Object.values(fields);

  db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...values, id);
}

export function softDeleteRow(
  db: Database.Database,
  table: string,
  id: string,
): void {
  const now = nowISO();
  db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ?, synced = 0 WHERE id = ?`).run(now, now, id);
}
