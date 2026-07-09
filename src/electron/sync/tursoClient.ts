import { config } from 'dotenv';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { app } from 'electron';
import path from 'path';

let client: Client | null = null;

function loadEnv(): void {
  if (app.isPackaged) {
    config({ path: path.join(process.resourcesPath, '.env') });
  } else {
    config();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }
  return value;
}

export function getTursoClient(): Client {
  if (!client) {
    loadEnv();
    client = createClient({
      url: requireEnv('TURSO_URL'),
      authToken: requireEnv('TURSO_AUTH_TOKEN'),
    });
  }
  return client;
}
