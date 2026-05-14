import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import type { UserWithRole } from 'better-auth/plugins/admin';
import { and, eq, inArray } from 'drizzle-orm';

import { config } from '../config.js';
import * as authSchema from '../db/auth.schema.js';
import { account, appSettings, inviteToken, user } from '../db/schema.js';
import type { Db } from '../db/index.js';
import { getGoogleAllowedDomains } from '../services/auth.service.js';
import { db } from './db.js';
import { logger } from './logger.js';

type GoogleSettings = {
  clientId: string;
  clientSecret: string;
  allowedDomains: string[];
};

function buildAuth(database: Db, google?: GoogleSettings) {
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
    databaseHooks: {
      account: {
        create: {
          before: async (acct) => {
            if (acct.providerId !== 'google') return;
            const domains = await getGoogleAllowedDomains(database);
            const [row] = await database
              .select({ email: user.email })
              .from(user)
              .where(eq(user.id, acct.userId))
              .limit(1);
            const domain = row?.email.split('@')[1]?.toLowerCase();
            if (!domain || !domains.includes(domain)) {
              throw new APIError('FORBIDDEN', { message: 'domain_not_allowed' });
            }
          },
          after: async (acct) => {
            if (acct.providerId !== 'google') return;
            try {
              await database.transaction(async (tx) => {
                await tx
                  .delete(account)
                  .where(and(eq(account.userId, acct.userId), eq(account.providerId, 'credential')));
                await tx.delete(inviteToken).where(eq(inviteToken.userId, acct.userId));
              });
            } catch (err: unknown) {
              logger.error(
                { err, userId: acct.userId },
                'failed to clean up credential row after google account link',
              );
            }
          },
        },
      },
    },
  };
  if (google) {
    opts.socialProviders = {
      google: { clientId: google.clientId, clientSecret: google.clientSecret },
    };
    opts.account = {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    };
  }
  return betterAuth(opts);
}

async function loadGoogleSettings(database: Db): Promise<GoogleSettings | undefined> {
  const rows = await database
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [
      'google_client_id',
      'google_client_secret',
      'google_allowed_domains',
    ]));

  const clientId = rows.find((r) => r.key === 'google_client_id')?.value;
  const clientSecret = rows.find((r) => r.key === 'google_client_secret')?.value;
  if (!clientId || !clientSecret) return undefined;

  const raw = rows.find((r) => r.key === 'google_allowed_domains')?.value;
  let allowedDomains: string[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        allowedDomains = parsed.filter((d): d is string => typeof d === 'string');
      }
    } catch {
      // Malformed value. Treated as empty — request-time hook will reject Google sign-ins.
    }
  }

  if (allowedDomains.length === 0) {
    logger.warn(
      'google credentials are configured but google_allowed_domains is empty or missing — all Google sign-ins will be rejected',
    );
  }

  return { clientId, clientSecret, allowedDomains };
}

const initialGoogle = await loadGoogleSettings(db).catch((err: unknown) => {
  logger.warn({ err }, 'failed to load google settings at startup; continuing without google provider');
  return undefined;
});

export let auth = buildAuth(db, initialGoogle);

export async function reloadAuth(): Promise<void> {
  const google = await loadGoogleSettings(db);
  auth = buildAuth(db, google);
}

export type AuthInstance = typeof auth;
type BaseSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type Session =
  | (Omit<BaseSession, 'user'> & { user: BaseSession['user'] & Partial<Pick<UserWithRole, 'role' | 'banned'>> })
  | null;
