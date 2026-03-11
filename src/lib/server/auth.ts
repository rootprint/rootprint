import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { admin } from 'better-auth/plugins';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: { enabled: true, disableSignUp: true },
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	plugins: [
		admin(),
		sveltekitCookies(getRequestEvent) // must be last
	]
});
