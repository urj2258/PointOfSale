import 'dotenv/config';
import { initDatabase, getDatabase, closeDatabase } from './database.js';
import crypto from 'crypto';

initDatabase();
const db = getDatabase();

if (process.env.SEED_FORCE === 'true') {
  const email = process.env.OWNER_EMAIL || 'owner@gmail.com';
  const password = process.env.OWNER_PASSWORD || 'owner123';
  const fullName = process.env.OWNER_NAME || 'Owner';
  const username = process.env.OWNER_USERNAME || 'owner';
  const now = new Date().toISOString();

  db.prepare('DELETE FROM users').run();
  db.prepare(`
    INSERT INTO users (id, full_name, email, username, password, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), fullName, email, username, password, now, now);

  console.log(`Owner reset: ${email} / ${password}`);
} else {
  const count = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (count === 0) {
    console.log('Database initialized. Owner was seeded during init.');
  } else {
    console.log('Owner already exists. Use SEED_FORCE=true to reset.');
  }
}

closeDatabase();
process.exit(0);
