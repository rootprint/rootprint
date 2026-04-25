import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { betterAuth } from 'better-auth/minimal';
import { admin, username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { and, eq } from 'drizzle-orm';

import { getRequestEvent } from '$app/server';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { account, inviteToken, user } from '$lib/server/db/schema';
import * as settingsService from '$lib/server/services/settings.service';

const googleSettings = settingsService.getGoogleAuthSettings();

export const auth = betterAuth({
	...(config.origin ? { baseURL: config.origin } : {}),
	secret: config.secret,
	emailAndPassword: { enabled: true, disableSignUp: true },
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	user: {
		additionalFields: {
			lastActive: {
				type: 'number',
				required: false,
				input: false
			},
			hasCredentialAccount: {
				type: 'boolean',
				required: false,
				input: false,
				defaultValue: false
			}
		}
	},
	...(googleSettings
		? {
				socialProviders: {
					google: {
						clientId: googleSettings.clientId,
						clientSecret: googleSettings.clientSecret
					}
				},
				account: {
					accountLinking: {
						enabled: true,
						trustedProviders: ['google']
					}
				}
			}
		: {}),
	databaseHooks: {
		account: {
			create: {
				before: async (accountData) => {
					if (accountData.providerId !== 'google') return;

					const settings = settingsService.getGoogleAuthSettings();
					if (!settings) {
						console.warn(
							'[logwiz] Google sign-in blocked: settings removed but provider still active'
						);
						throw new APIError('FORBIDDEN', { message: 'domain_not_allowed' });
					}

					// Look up the user's email
					const [userData] = db
						.select({ email: user.email })
						.from(user)
						.where(eq(user.id, accountData.userId))
						.all();

					if (!userData) {
						throw new APIError('FORBIDDEN', { message: 'domain_not_allowed' });
					}

					const domain = userData.email.split('@')[1]?.toLowerCase();
					if (!domain || !settings.allowedDomains.includes(domain)) {
						console.warn(`[logwiz] Google sign-in blocked: domain "${domain}" not in allowed list`);
						throw new APIError('FORBIDDEN', { message: 'domain_not_allowed' });
					}
				},
				after: async (accountData) => {
					if (accountData.providerId === 'credential') {
						db.update(user)
							.set({ hasCredentialAccount: true })
							.where(eq(user.id, accountData.userId))
							.run();
						return;
					}

					if (accountData.providerId !== 'google') return;

					try {
						db.transaction((tx) => {
							tx.delete(account)
								.where(
									and(eq(account.userId, accountData.userId), eq(account.providerId, 'credential'))
								)
								.run();

							tx.delete(inviteToken).where(eq(inviteToken.userId, accountData.userId)).run();

							tx.update(user)
								.set({ hasCredentialAccount: false })
								.where(eq(user.id, accountData.userId))
								.run();
						});
					} catch (e) {
						console.error(
							`[logwiz] Failed to clean up credential data for user ${accountData.userId}:`,
							e
						);
						throw e;
					}
				}
			}
		}
	},
	rateLimit: {
		enabled: true,
		window: config.rateLimitWindow,
		max: config.rateLimitMax,
		customRules: {
			'/sign-in/email': {
				window: config.rateLimitWindow,
				max: config.signinRateLimitMax
			},
			'/sign-in/username': {
				window: config.rateLimitWindow,
				max: config.signinRateLimitMax
			},
			'/sign-in/social': {
				window: config.rateLimitWindow,
				max: config.signinRateLimitMax
			}
		}
	},
	plugins: [
		admin(),
		username(),
		sveltekitCookies(getRequestEvent) // must be last
	]
});
