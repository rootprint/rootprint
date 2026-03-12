import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { mkdirSync } from 'fs';

mkdirSync('./data', { recursive: true });

const sqlite = new Database('./data/logwiz.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

console.log('Running database migrations...');
migrate(db, { migrationsFolder: './drizzle' });
console.log('Database migrations complete.');
