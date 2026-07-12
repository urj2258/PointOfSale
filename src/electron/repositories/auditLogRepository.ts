import { getDatabase } from '../database.js';
import crypto from 'crypto';

export interface AuditLog {
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
  try {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_logs (id, action, status, user_id, user_name, details, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), action, status, userId, userName, details ?? null, now, now);
  } catch {
    // Never let audit logging crash the main operation
  }
}

export function getAuditLogs(page = 1, limit = 50): { logs: AuditLog[]; total: number } {
  const db = getDatabase();
  const offset = (page - 1) * limit;
  const total = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as AuditLog[];
  return { logs, total };
}
