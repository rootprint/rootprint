import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

import { intEnv, optionalUrlEnv, requireEnv, requireUrlEnv } from './utils/require-env.js';

const repoRootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
loadEnv({ path: repoRootEnv });

export const config = {
	databaseUrl: requireEnv('DATABASE_URL'),
	origin: requireUrlEnv('ORIGIN'),
	quickwitUrl: requireUrlEnv('QUICKWIT_URL'),
	frontendUrl: optionalUrlEnv('FRONTEND_URL'),
	port: intEnv('PORT', 8282),
	trustedProxyHops: intEnv('TRUST_PROXY_HOPS', 0),
	rateLimitWindowMs: intEnv('RATE_LIMIT_WINDOW_MS', 60_000),
	publicAuthRateLimit: intEnv('PUBLIC_AUTH_RATE_LIMIT', 30),
	readRateLimit: intEnv('READ_RATE_LIMIT', 300)
};
