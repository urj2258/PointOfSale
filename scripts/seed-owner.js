/**
 * Seed Owner Script
 *
 * Runs the seed process inside Electron (where native modules are compiled for).
 *
 * Usage:
 *   npm run seed:owner
 *   npm run seed:owner:force
 *
 * Custom credentials via env vars (passed to Electron):
 *   OWNER_EMAIL=admin@mystore.com OWNER_PASSWORD=secret123 npm run seed:owner
 */

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function getElectronBinary() {
  const platform = process.platform;
  const ext = platform === 'win32' ? '.cmd' : '';
  const local = path.join(root, 'node_modules', '.bin', `electron${ext}`);
  if (fs.existsSync(local)) return local;
  return `electron${ext}`;
}

const electronBin = getElectronBinary();
const seedScript = path.join(root, 'dist-electron', 'seed-cli.js');

if (!fs.existsSync(seedScript)) {
  console.error('Seed script not compiled. Run `npm run transpile:electron` first.');
  process.exit(1);
}

const env = { ...process.env };

if (process.argv.includes('--force') || process.argv.includes('-f')) {
  env.SEED_FORCE = 'true';
}
if (process.env.OWNER_EMAIL) env.OWNER_EMAIL = process.env.OWNER_EMAIL;
if (process.env.OWNER_PASSWORD) env.OWNER_PASSWORD = process.env.OWNER_PASSWORD;
if (process.env.OWNER_NAME) env.OWNER_NAME = process.env.OWNER_NAME;
if (process.env.OWNER_USERNAME) env.OWNER_USERNAME = process.env.OWNER_USERNAME;

console.log('');
console.log('=== POS Owner Seed Script ===');
console.log('');

const result = spawnSync(electronBin, [seedScript], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error('Failed to run Electron:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
