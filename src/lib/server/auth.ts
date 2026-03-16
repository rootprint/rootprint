import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin, username } from 'better-auth/plugins';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { config } from '$lib/server/config';

export const auth = betterAuth({
	baseURL: config.origin,
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
			}
		}
	},
	plugins: [
		admin(),
		username(),
		sveltekitCookies(getRequestEvent) // must be last
	]
});
