import { existsSync } from 'node:fs';
import path from 'node:path';

import { ensureDatabase } from '../apps/api/tests/helpers/db-admin.ts';

const PORT = Number(process.env.E2E_API_PORT ?? 18283);
const DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? 'postgres://rootprint:rootprint@localhost:5432/rootprint_e2e';

const webIndex = path.resolve(import.meta.dir, '../apps/web/build/index.html');
if (!existsSync(webIndex)) {
	throw new Error('apps/web/build is missing. Run `bun --filter web build` first.');
}

process.env.DATABASE_URL = DATABASE_URL;
process.env.ORIGIN = `http://127.0.0.1:${PORT}`;
process.env.QUICKWIT_URL = process.env.E2E_QUICKWIT_URL ?? 'http://127.0.0.1:7290';
process.env.TRUST_PROXY_HOPS = '1';
process.env.BETTER_AUTH_SECRET = '';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'warn';
// Better Auth disables its origin/CSRF check when NODE_ENV=test; the image runs production.
process.env.NODE_ENV = 'production';

await ensureDatabase(DATABASE_URL);
const { app, boot } = await import('../apps/api/src/app.ts');
await boot();
Bun.serve({ port: PORT, hostname: '127.0.0.1', fetch: app.fetch, idleTimeout: 255 });
console.log(`e2e api listening at ${process.env.ORIGIN}`);
