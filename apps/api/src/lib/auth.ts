import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin } from 'better-auth/plugins';
import type { UserWithRole } from 'better-auth/plugins/admin';
import { and, eq } from 'drizzle-orm';

import { config } from '../config.js';
import * as authSchema from '../db/auth.schema.js';
import { account, inviteToken, user } from '../db/schema.js';
import { getGoogleAllowedDomains } from '../services/auth.service.js';
import {
	loadGoogleAuthForBetterAuth,
	type GoogleAuthCredentials
} from '../services/settings.service.js';
import { db } from './db.js';

function buildAuth(secret: string, google?: GoogleAuthCredentials) {
	const trustedOrigins = [config.origin, ...(config.frontendUrl ? [config.frontendUrl] : [])];

	const opts: BetterAuthOptions = {
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
		plugins: [admin()],
		trustedOrigins,
		secret,
		baseURL: config.origin,
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
						const domains = await getGoogleAllowedDomains(db);
						const [row] = await db
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
						await db.transaction(async (tx) => {
							await tx
								.delete(account)
								.where(
									and(eq(account.userId, acct.userId), eq(account.providerId, 'credential'))
								);
							await tx.delete(inviteToken).where(eq(inviteToken.userId, acct.userId));
						});
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

type AuthInstanceInternal = ReturnType<typeof buildAuth>;

const holder: {
	instance: AuthInstanceInternal | null;
	secret: string | null;
} = {
	instance: null,
	secret: null
};

/**
 * Initialize Better Auth exactly once during the boot sequence.
 * Subsequent calls throw — re-init from runtime changes goes through reloadAuth().
 */
export async function initAuth(secret: string): Promise<void> {
	if (holder.instance !== null) {
		throw new Error('initAuth has already been called');
	}
	const google = await loadGoogleAuthForBetterAuth(db).catch(() => undefined);
	holder.secret = secret;
	holder.instance = buildAuth(secret, google);
}

export const auth = (): AuthInstanceInternal => {
	if (holder.instance === null) {
		throw new Error('auth() called before initAuth(); ensure boot sequence ran');
	}
	return holder.instance;
};

export async function reloadAuth(): Promise<void> {
	if (holder.secret === null) {
		throw new Error('reloadAuth called before initAuth');
	}
	const google = await loadGoogleAuthForBetterAuth(db);
	holder.instance = buildAuth(holder.secret, google);
}

export type AuthInstance = AuthInstanceInternal;
type BaseSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type Session =
	| (Omit<BaseSession, 'user'> & {
			user: BaseSession['user'] & Partial<Pick<UserWithRole, 'role' | 'banned'>>;
	  })
	| null;

export const isAdmin = (session: Session | undefined): boolean => session?.user.role === 'admin';
