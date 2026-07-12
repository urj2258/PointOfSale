import { getDatabase } from '../database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface UserRow {
  id: string
  full_name: string
  email: string
  username: string
  password: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: number
}

export function loginUser(email: string, password: string) {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email) as UserRow | undefined;
  if (!user) return null;
  const match = bcrypt.compareSync(password, user.password);
  if (!match) return null;
  const { password: _, ...safe } = user;
  return safe;
}

export function registerOwner(fullName: string, email: string, username: string, password: string) {
  const db = getDatabase();
  const existingCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (existingCount > 0) throw new Error('An owner already exists. Only one owner account is allowed.');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (id, full_name, email, username, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fullName, email, username, hashedPassword, now, now);
  return { id, full_name: fullName, email, username, created_at: now, updated_at: now };
}

export function getOwnerStatus() {
  const db = getDatabase();
  const count = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  return { hasOwner: count > 0 };
}

export function getOwner(): { id: string; full_name: string } | null {
  const db = getDatabase();
  const user = db.prepare('SELECT id, full_name FROM users WHERE deleted_at IS NULL LIMIT 1').get() as { id: string; full_name: string } | undefined;
  return user ?? null;
}
