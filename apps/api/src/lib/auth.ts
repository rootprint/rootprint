import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin, openAPI } from 'better-auth/plugins';
import type { UserWithRole } from 'better-auth/plugins/admin';
import { and, eq } from 'drizzle-orm';

import { config } from '../config.js';
import * as authSchema from '../db/auth.schema.js';
import { account, inviteToken, user } from '../db/schema.js';
import {
	githubTokenIsAllowed,
	googleEmailIsAllowed,
	userRetainsOAuthAccess
} from '../services/auth.service.js';
import {
	loadGitHubAuthForBetterAuth,
	loadGoogleAuthForBetterAuth
} from '../services/settings.service.js';
import type { GitHubAuthCredentials, GoogleAuthCredentials } from '../types.js';
import { db } from './db.js';

function buildAuth(secret: string, google?: GoogleAuthCredentials, github?: GitHubAuthCredentials) {
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
						if (acct.providerId === 'google') {
							const [row] = await db
								.select({ email: user.email })
								.from(user)
								.where(eq(user.id, acct.userId))
								.limit(1);
							if (!row?.email || !(await googleEmailIsAllowed(db, row.email))) {
								throw new APIError('FORBIDDEN', { message: 'domain_not_allowed' });
							}
							return;
						}
						if (acct.providerId === 'github') {
							if (!(await githubTokenIsAllowed(db, acct.accessToken))) {
								throw new APIError('FORBIDDEN', { message: 'org_not_allowed' });
							}
							return;
						}
					},
					after: async (acct) => {
						if (acct.providerId !== 'google' && acct.providerId !== 'github') return;
						await db.transaction(async (tx) => {
							await tx
								.delete(account)
								.where(and(eq(account.userId, acct.userId), eq(account.providerId, 'credential')));
							await tx.delete(inviteToken).where(eq(inviteToken.userId, acct.userId));
						});
					}
				}
			},
			session: {
				create: {
					before: async (session) => {
						if (await userRetainsOAuthAccess(db, session.userId)) return;
						console.warn(
							'[oauth_access] blocking session: user no longer satisfies provider membership',
							session.userId
						);
						return false;
					}
				}
			}
		}
	};
	const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {};
	const trustedProviders: string[] = [];
	if (google) {
		socialProviders.google = { clientId: google.clientId, clientSecret: google.clientSecret };
		trustedProviders.push('google');
	}
	if (github) {
		socialProviders.github = {
			clientId: github.clientId,
			clientSecret: github.clientSecret,
			// read:org resolves private org memberships; user:email is required by GitHub.
			scope: ['read:org', 'user:email']
		};
		trustedProviders.push('github');
	}
	if (trustedProviders.length > 0) {
		opts.socialProviders = socialProviders;
		opts.account = {
			accountLinking: { enabled: true, trustedProviders }
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
	const github = await loadGitHubAuthForBetterAuth(db).catch(() => undefined);
	holder.secret = secret;
	holder.instance = buildAuth(secret, google, github);
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
	const github = await loadGitHubAuthForBetterAuth(db);
	holder.instance = buildAuth(holder.secret, google, github);
}

export type AuthInstance = AuthInstanceInternal;
type BaseSession = NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>;
export type Session =
	| (Omit<BaseSession, 'user'> & {
			user: BaseSession['user'] & Partial<Pick<UserWithRole, 'role' | 'banned'>>;
	  })
	| null;

export const isAdmin = (session: Session | undefined): boolean => session?.user.role === 'admin';

export async function authOpenAPISchema() {
	const instance = betterAuth({
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
		plugins: [admin(), openAPI()],
		baseURL: config.origin,
		secret: 'openapi-schema-generation',
		emailAndPassword: { enabled: true, disableSignUp: true }
	});
	return instance.api.generateOpenAPISchema();
}
