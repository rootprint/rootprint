import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import type { UserWithRole } from 'better-auth/plugins/admin';
import { inArray } from 'drizzle-orm';

import { config } from '../config.js';
import * as authSchema from '../db/auth.schema.js';
import { appSettings } from '../db/schema.js';
import type { Db } from '../db/index.js';
import { db } from './db.js';
import { logger } from './logger.js';

function buildAuth(database: Db, googleCreds?: { clientId: string; clientSecret: string }) {
  const opts: BetterAuthOptions = {
    database: drizzleAdapter(database, { provider: 'pg', schema: authSchema }),
    plugins: [admin()],
    trustedOrigins: [config.frontendUrl],
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    session: { cookieCache: { enabled: true } },
    emailAndPassword: { enabled: true, disableSignUp: true },
    user: {
      additionalFields: {
        lastActive: { type: 'date', required: false, returned: true },
      },
    },
  };
  if (googleCreds) opts.socialProviders = { google: googleCreds };
  return betterAuth(opts);
}

async function loadGoogleCreds(database: Db): Promise<{ clientId: string; clientSecret: string } | undefined> {
  const rows = await database
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, ['google_client_id', 'google_client_secret']));
  const clientId = rows.find((r) => r.key === 'google_client_id')?.value;
  const clientSecret = rows.find((r) => r.key === 'google_client_secret')?.value;
  if (!clientId || !clientSecret) return undefined;
  return { clientId, clientSecret };
}

const initialCreds = await loadGoogleCreds(db).catch((err) => {
  logger.warn({ err }, 'failed to load google creds at startup; continuing without google provider');
  return undefined;
});

export let auth = buildAuth(db, initialCreds);

export async function reloadAuth(): Promise<void> {
  const creds = await loadGoogleCreds(db);
  auth = buildAuth(db, creds);
}

export type AuthInstance = typeof auth;
type BaseSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type Session =
  | (Omit<BaseSession, 'user'> & { user: BaseSession['user'] & Partial<Pick<UserWithRole, 'role' | 'banned'>> })
  | null;
