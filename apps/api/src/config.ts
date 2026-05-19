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
	port: intEnv('PORT', 8282)
};

export type AppConfig = typeof config;
