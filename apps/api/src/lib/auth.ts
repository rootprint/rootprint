import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { admin, openAPI } from 'better-auth/plugins';
import { apiKey } from '@better-auth/api-key';
import { and, eq } from 'drizzle-orm';

import { config } from '../config.js';
import * as authSchema from '../db/auth.schema.js';
import { account, inviteToken, user } from '../db/schema.js';
import {
	githubTokenIsAllowed,
	googleEmailIsAllowed,
	userRetainsOAuthAccess
} from '../services/auth.service.js';
import { loadOAuthProviders } from '../services/settings.service.js';
import type { OAuthCredentials } from '../types.js';
import { db } from './db.js';
import { logger } from './logger.js';

const apiKeyPluginConfig = {
	defaultPrefix: 'rpk_',
	requireName: true,
	maximumNameLength: 100,
	startingCharactersConfig: { shouldStore: true, charactersLength: 10 },
	keyExpiration: { disableCustomExpiresTime: true },
	rateLimit: { enabled: false },
	deferUpdates: true,
	permissions: { defaultPermissions: { logs: ['read'] } }
} satisfies Parameters<typeof apiKey>[0];

function oauthCheckUnavailable(): APIError {
	return new APIError('SERVICE_UNAVAILABLE', {
		code: 'oauth_check_unavailable',
		message: 'Could not verify OAuth access right now'
	});
}

function buildAuth(secret: string, google?: OAuthCredentials, github?: OAuthCredentials) {
	const trustedOrigins = [config.origin, ...(config.frontendUrl ? [config.frontendUrl] : [])];

	const opts: BetterAuthOptions = {
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
		plugins: [admin(), apiKey(apiKeyPluginConfig)],
		trustedOrigins,
		secret,
		baseURL: config.origin,
		session: { cookieCache: { enabled: true } },
		rateLimit: { enabled: true },
		advanced: { ipAddress: { ipAddressHeaders: ['x-rootprint-client-ip'] } },
		// Every OAuth failure path falls back to this, so no per-flow
		// errorCallbackURL is needed. Absolute because the API also serves the SPA
		// at its own origin, which a relative path would strand split deployments on.
		onAPIError: { errorURL: `${config.frontendUrl ?? config.origin}/auth/sign-in` },
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
								throw new APIError('FORBIDDEN', {
									code: 'domain_not_allowed',
									message: 'Email domain not allowed'
								});
							}
							return;
						}
						if (acct.providerId === 'github') {
							let allowed: boolean;
							try {
								allowed = await githubTokenIsAllowed(db, acct.accessToken);
							} catch (err) {
								logger.error({ err, userId: acct.userId }, 'github org check unavailable');
								throw oauthCheckUnavailable();
							}
							if (!allowed) {
								throw new APIError('FORBIDDEN', {
									code: 'org_not_allowed',
									message: 'GitHub organization not allowed'
								});
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
						let retained: boolean;
						try {
							retained = await userRetainsOAuthAccess(db, session.userId);
						} catch (err) {
							logger.error({ err, userId: session.userId }, 'oauth access check unavailable');
							throw oauthCheckUnavailable();
						}
						if (retained) return;
						logger.warn({ userId: session.userId }, 'oauth access blocked');
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
	const [google, github] = await loadOAuthProviders(db);
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
	const [google, github] = await loadOAuthProviders(db);
	holder.instance = buildAuth(holder.secret, google, github);
}

export type AuthInstance = AuthInstanceInternal;

export async function authOpenAPISchema() {
	const instance = betterAuth({
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
		plugins: [admin(), apiKey(apiKeyPluginConfig), openAPI()],
		baseURL: config.origin,
		secret: 'openapi-schema-generation-only',
		emailAndPassword: { enabled: true, disableSignUp: true }
	});
	return instance.api.generateOpenAPISchema();
}
