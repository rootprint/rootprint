import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import type { UserWithRole } from 'better-auth/plugins/admin';
import { and, eq } from 'drizzle-orm';

import { config } from '../config.js';
import * as authSchema from '../db/auth.schema.js';
import { account, inviteToken, user } from '../db/schema.js';
import type { Db } from '../db/index.js';
import { getGoogleAllowedDomains } from '../services/auth.service.js';
import {
	loadGoogleAuthForBetterAuth,
	type GoogleAuthCredentials
} from '../services/settings.service.js';
import { db } from './db.js';
import { logger } from './logger.js';

function buildAuth(database: Db, google?: GoogleAuthCredentials) {
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
				lastActive: { type: 'date', required: false, returned: true }
			}
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
									.where(
										and(eq(account.userId, acct.userId), eq(account.providerId, 'credential'))
									);
								await tx.delete(inviteToken).where(eq(inviteToken.userId, acct.userId));
							});
						} catch (err: unknown) {
							logger.error(
								{ err, userId: acct.userId },
								'failed to clean up credential row after google account link'
							);
						}
					}
				}
			}
		}
	};
	if (google) {
		opts.socialProviders = {
			google: { clientId: google.clientId, clientSecret: google.clientSecret }
		};
		opts.account = {
			accountLinking: {
				enabled: true,
				trustedProviders: ['google']
			}
		};
	}
	return betterAuth(opts);
}

async function loadGoogle(database: Db): Promise<GoogleAuthCredentials | undefined> {
	const google = await loadGoogleAuthForBetterAuth(database);
	if (google && google.allowedDomains.length === 0) {
		logger.warn(
			'google credentials are configured but google_allowed_domains is empty or missing — all Google sign-ins will be rejected'
		);
	}
	return google;
}

const initialGoogle = await loadGoogle(db).catch((err: unknown) => {
	logger.warn(
		{ err },
		'failed to load google settings at startup; continuing without google provider'
	);
	return undefined;
});

export let auth = buildAuth(db, initialGoogle);

export async function reloadAuth(): Promise<void> {
	const google = await loadGoogle(db);
	auth = buildAuth(db, google);
}

export type AuthInstance = typeof auth;
type BaseSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type Session =
	| (Omit<BaseSession, 'user'> & {
			user: BaseSession['user'] & Partial<Pick<UserWithRole, 'role' | 'banned'>>;
	  })
	| null;

export const isAdmin = (session: Session | undefined): boolean => session?.user.role === 'admin';
