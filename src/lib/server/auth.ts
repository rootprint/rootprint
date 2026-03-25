import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin, username } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import * as settingsService from '$lib/server/services/settings.service';

const googleSettings = settingsService.getGoogleAuthSettings();

if (googleSettings) {
	console.log(
		`[logwiz] Google auth enabled for domains: ${googleSettings.allowedDomains.join(', ')}`
	);
}

export const auth = betterAuth({
	...(config.origin ? { baseURL: config.origin } : {}),
	secret: config.secret,
	emailAndPassword: { enabled: true, disableSignUp: true },
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	user: {
		additionalFields: {
			mustChangePassword: {
				type: 'boolean',
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
						console.warn('[logwiz] Google sign-in blocked: settings removed but provider still active');
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
						console.warn(
							`[logwiz] Google sign-in blocked: domain "${domain}" not in allowed list`
						);
						throw new APIError('FORBIDDEN', { message: 'domain_not_allowed' });
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

export { googleSettings };
