import { getDatabase } from '../database.js';
import crypto from 'crypto';

export interface UserRow {
  id: string
  full_name: string
  email: string
  username: string
  password: string
  created_at: string
  updated_at: string
}

export function loginUser(email: string, password: string) {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as UserRow | undefined;
  if (!user) return null;
  const { password: _, ...safe } = user;
  return safe;
}

export function registerOwner(fullName: string, email: string, username: string, password: string) {
  const db = getDatabase();
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (existingCount > 0) throw new Error('An owner already exists. Only one owner account is allowed.');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (id, full_name, email, username, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fullName, email, username, password, now, now);
  return { id, full_name: fullName, email, username, created_at: now, updated_at: now };
}

export function getOwnerStatus() {
  const db = getDatabase();
  const count = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  return { hasOwner: count > 0 };
}
