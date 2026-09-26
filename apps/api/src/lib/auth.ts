import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, openAPI } from 'better-auth/plugins';
import { github } from 'better-auth/social-providers';
import { apiKey } from '@better-auth/api-key';
import { eq } from 'drizzle-orm';

import { config } from '../config.js';
import { USER_ADDITIONAL_FIELDS } from '../constants.js';
import * as authSchema from '../db/auth.schema.js';
import { inviteToken } from '../db/schema.js';
import { githubTokenIsAllowed, googleEmailIsAllowed } from '../services/auth.service.js';
import { discoveryUrl, verifyOidcIssuer } from '../services/oidc.service.js';
import { loadAuthConfig } from '../services/settings.service.js';
import type { AuthConfig } from '../services/settings.service.js';
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

const unavailable = {
	error: 'oauth_check_unavailable',
	errorDescription: 'Could not verify OAuth access right now'
};

function buildAuth(secret: string, cfg: AuthConfig) {
	const oidc = cfg.oidc;
	const trustedOrigins = [config.origin, ...(config.frontendUrl ? [config.frontendUrl] : [])];

	const opts: BetterAuthOptions = {
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
		plugins: [
			apiKey(apiKeyPluginConfig),
			...(oidc
				? [
						genericOAuth({
							config: [
								{
									providerId: 'oidc',
									discoveryUrl: discoveryUrl(oidc.issuerUrl),
									clientId: oidc.clientId,
									clientSecret: oidc.clientSecret,
									authentication: cfg.oidcTokenAuth,
									scopes: ['openid', 'profile', 'email'],
									requireIdTokenVerification: true,
									// Keep sign-out local; the client would otherwise follow the IdP end-session redirect.
									disableProviderLogout: true,
									// `sub` is unique only within an issuer. Qualifying it means a row left over
									// from a previous issuer can never match a subject from the current one.
									accountSubject: ({ profile }) => {
										// Numeric subjects are legal, so only an absent or empty one is refused.
										const sub = profile.sub;
										if (sub === undefined || sub === null || sub === '') {
											throw new Error('ID token carries no sub');
										}
										return `${oidc.issuerUrl}|${String(sub)}`;
									}
								}
							]
						})
					]
				: [])
		],
		disabledPaths: cfg.passwordSignInDisabled ? ['/sign-in/email'] : [],
		trustedOrigins,
		secret,
		baseURL: config.origin,
		rateLimit: { enabled: true },
		advanced: { ipAddress: { ipAddressHeaders: ['x-rootprint-client-ip'] } },
		// Every OAuth failure path falls back to this, so no per-flow
		// errorCallbackURL is needed. Absolute because the API also serves the SPA
		// at its own origin, which a relative path would strand split deployments on.
		onAPIError: { errorURL: `${config.frontendUrl ?? config.origin}/auth/sign-in` },
		emailAndPassword: { enabled: true, disableSignUp: true },
		user: {
			additionalFields: USER_ADDITIONAL_FIELDS,
			// Runs for every OAuth create, link, and repeat sign-in, before any row is written.
			validateUserInfo: async ({ user, source }) => {
				if (source.method !== 'oauth' || !source.oauth) return;
				if (source.oauth.providerId === 'google') {
					let allowed: boolean;
					try {
						allowed = !!user.email && (await googleEmailIsAllowed(db, user.email));
					} catch (err) {
						logger.error({ err }, 'google domain check unavailable');
						return unavailable;
					}
					if (!allowed) {
						return { error: 'domain_not_allowed', errorDescription: 'Email domain not allowed' };
					}
					return;
				}
				if (source.oauth.providerId === 'github') {
					const profile = source.oauth.profile as { orgAllowed?: boolean | null } | undefined;
					const orgAllowed = profile?.orgAllowed;
					if (orgAllowed === null) return unavailable;
					if (!orgAllowed) {
						return {
							error: 'org_not_allowed',
							errorDescription: 'GitHub organization not allowed'
						};
					}
				}
			}
		},
		databaseHooks: {
			account: {
				create: {
					// Onboarding through a provider consumes the invite; the users list would
					// otherwise show the user as pending until the token expires.
					after: async (acct) => {
						if (acct.providerId === 'credential') return;
						await db.delete(inviteToken).where(eq(inviteToken.userId, acct.userId));
					}
				}
			}
		}
	};
	const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {};
	if (cfg.google) {
		socialProviders.google = {
			clientId: cfg.google.clientId,
			clientSecret: cfg.google.clientSecret
		};
	}
	if (cfg.github) {
		const creds = { clientId: cfg.github.clientId, clientSecret: cfg.github.clientSecret };
		const stock = github(creds);
		socialProviders.github = {
			...creds,
			// read:org resolves private org memberships; user:email is required by GitHub.
			scope: ['read:org', 'user:email'],
			// validateUserInfo never sees the access token, so the org verdict rides on the profile.
			getUserInfo: async (token) => {
				const info = await stock.getUserInfo(token);
				// A null profile ends the callback as unable_to_get_user_info before the hook runs.
				if (!info) return null;
				let orgAllowed: boolean | null;
				try {
					orgAllowed = await githubTokenIsAllowed(db, token.accessToken);
				} catch (err) {
					logger.error({ err }, 'github org check unavailable');
					orgAllowed = null;
				}
				return { ...info, data: { ...info.data, orgAllowed } as typeof info.data };
			}
		};
	}
	if (cfg.google || cfg.github) opts.socialProviders = socialProviders;
	// The admin's own IdP is trusted like Google and GitHub: many providers (Entra ID
	// among them) never send email_verified, and untrusted linking requires it.
	const trustedProviders = (['google', 'github', 'oidc'] as const).filter((id) => cfg[id]);
	opts.account = {
		encryptOAuthTokens: true,
		// Local verification is relaxed because only admins create users here.
		accountLinking: { enabled: true, trustedProviders, requireLocalEmailVerified: false }
	};
	return betterAuth(opts);
}

const OIDC_RETRY_MS = config.oidcRetryMs;
let oidcRetry: ReturnType<typeof setTimeout> | null = null;

function clearOidcRetry(): void {
	if (oidcRetry) clearTimeout(oidcRetry);
	oidcRetry = null;
}

/** A transient IdP outage at boot must not leave SSO off until someone re-saves settings. */
function scheduleOidcRetry(): void {
	clearOidcRetry();
	oidcRetry = setTimeout(() => {
		oidcRetry = null;
		void reloadAuth().catch((err: unknown) => logger.error({ err }, 'oidc retry reload failed'));
	}, OIDC_RETRY_MS);
	oidcRetry.unref();
}

/**
 * The plugin fetches discovery at init with no timeout, and every request awaits
 * init, so an unreachable issuer would stall the whole auth path. Probe it with
 * the bounded save-time check first and build without OIDC when it fails.
 */
async function loadReachableAuthConfig(): Promise<AuthConfig> {
	const cfg = await loadAuthConfig(db);
	clearOidcRetry();
	if (!cfg.oidc) return cfg;
	try {
		const { tokenAuth } = await verifyOidcIssuer(cfg.oidc.issuerUrl);
		return { ...cfg, oidcTokenAuth: tokenAuth };
	} catch (err) {
		logger.warn(
			{ err, issuerUrl: cfg.oidc.issuerUrl, retryInMs: OIDC_RETRY_MS },
			'oidc discovery unreachable; provider disabled until the retry succeeds'
		);
		scheduleOidcRetry();
		return { ...cfg, oidc: undefined };
	}
}

/**
 * The plugin re-fetches discovery during init and silently skips the provider when
 * that fetch or its content fails. Waiting for init keeps the previous instance
 * serving meanwhile, and lets /providers report only what was actually registered.
 */
async function buildReadyAuth(secret: string, cfg: AuthConfig) {
	const instance = buildAuth(secret, cfg);
	const ctx = await instance.$context;
	if (cfg.oidc && !ctx.socialProviders.some((p) => p.id === 'oidc')) {
		logger.warn(
			{ issuerUrl: cfg.oidc.issuerUrl, retryInMs: OIDC_RETRY_MS },
			'oidc provider skipped by better-auth init; disabled until the retry succeeds'
		);
		scheduleOidcRetry();
		return {
			instance: buildAuth(secret, { ...cfg, oidc: undefined }),
			cfg: { ...cfg, oidc: undefined }
		};
	}
	return { instance, cfg };
}

type AuthInstanceInternal = ReturnType<typeof buildAuth>;

const holder: {
	instance: AuthInstanceInternal | null;
	secret: string | null;
	cfg: AuthConfig | null;
} = {
	instance: null,
	secret: null,
	cfg: null
};

/**
 * Initialize Better Auth exactly once during the boot sequence.
 * Subsequent calls throw — re-init from runtime changes goes through reloadAuth().
 */
export async function initAuth(secret: string): Promise<void> {
	if (holder.instance !== null) {
		throw new Error('initAuth has already been called');
	}
	holder.secret = secret;
	await rebuild();
}

export const auth = (): AuthInstanceInternal => {
	if (holder.instance === null) {
		throw new Error('auth() called before initAuth(); ensure boot sequence ran');
	}
	return holder.instance;
};

/** What the live instance was built from; OIDC is absent here when its discovery failed. */
export const authConfig = (): AuthConfig => {
	if (holder.cfg === null) {
		throw new Error('authConfig() called before initAuth(); ensure boot sequence ran');
	}
	return holder.cfg;
};

async function rebuild(): Promise<void> {
	if (holder.secret === null) {
		throw new Error('reloadAuth called before initAuth');
	}
	const ready = await buildReadyAuth(holder.secret, await loadReachableAuthConfig());
	holder.cfg = ready.cfg;
	holder.instance = ready.instance;
}

let reloading: Promise<void> = Promise.resolve();

/** Serialized so two admin writes cannot finish their reloads out of order. */
export function reloadAuth(): Promise<void> {
	reloading = reloading.catch(() => undefined).then(rebuild);
	return reloading;
}

export type AuthInstance = AuthInstanceInternal;

export async function authOpenAPISchema() {
	const instance = betterAuth({
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
		plugins: [apiKey(apiKeyPluginConfig), openAPI()],
		baseURL: config.origin,
		secret: 'openapi-schema-generation-only',
		emailAndPassword: { enabled: true, disableSignUp: true },
		user: {
			additionalFields: USER_ADDITIONAL_FIELDS
		}
	});
	return instance.api.generateOpenAPISchema();
}
