import { ensureDatabase } from './helpers/db-admin.js';
import { API_PORT, BASE_URL, QUICKWIT_URL, TEST_DATABASE_URL } from './helpers/env.js';
import { installOutboundInterceptor } from './helpers/outbound.js';

installOutboundInterceptor();

// Set before any src/ import: config, db and auth read these at module load.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.ORIGIN = BASE_URL;
process.env.QUICKWIT_URL = QUICKWIT_URL;
process.env.TRUST_PROXY_HOPS = '1';
process.env.OIDC_RETRY_MS = '200';
// Empty, not deleted: dotenv would otherwise fill it from the repo .env.
process.env.BETTER_AUTH_SECRET = '';
process.env.LOG_LEVEL = 'silent';
// bun test sets NODE_ENV=test, and Better Auth silently disables its origin/CSRF check under
// that value. The Docker image runs production, so the suite must too.
process.env.NODE_ENV = 'production';

await ensureDatabase(TEST_DATABASE_URL);
const { app, boot } = await import('../src/app.js');
await boot();
Bun.serve({ port: API_PORT, hostname: '127.0.0.1', fetch: app.fetch, idleTimeout: 255 });
