/**
 * Seed Test Data Script
 * Runs inside Electron to populate local database with test records.
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
const seedScript = path.join(root, 'dist-electron', 'seed-test-data.js');

if (!fs.existsSync(seedScript)) {
  console.error('Test data script not compiled. Run `npm run transpile:electron` first.');
  process.exit(1);
}

const env = { ...process.env };

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
