import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import { config } from '../config.js';
import * as schema from '../db/schema.js';

const CONNECT_RETRY_COUNT = 10;
const CONNECT_RETRY_DELAY_MS = 2000;

export const db = drizzle(new pg.Pool({ connectionString: config.databaseUrl }), { schema });
export type Db = typeof db;

export async function connectDb(): Promise<void> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= CONNECT_RETRY_COUNT; attempt++) {
		try {
			await db.$client.query('SELECT 1');
			return;
		} catch (err) {
			lastError = err;
			if (attempt < CONNECT_RETRY_COUNT) {
				await new Promise<void>((r) => setTimeout(r, CONNECT_RETRY_DELAY_MS));
			}
		}
	}
	throw new Error(
		`Failed to connect to Postgres after ${CONNECT_RETRY_COUNT} attempts: ${String(lastError)}`
	);
}

export async function runMigrations(): Promise<void> {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [path.resolve(here, '../../drizzle'), path.resolve(here, '../drizzle')];
	const migrationsFolder = candidates.find((p) => existsSync(p));
	if (!migrationsFolder) {
		throw new Error(`Migrations folder not found. Tried: ${candidates.join(', ')}`);
	}
	await migrate(db, { migrationsFolder });
}
