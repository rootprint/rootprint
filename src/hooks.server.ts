import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { and, eq } from 'drizzle-orm';
import { RetryAfterRateLimiter } from 'sveltekit-rate-limiter/server';

import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import { syncIndexesFromQuickwit } from '$lib/server/services/index.service';

async function seedDefaultAdmin() {
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
		.limit(1);
	if (existing) return;

	await auth.api.createUser({
		body: {
			email: config.adminEmail,
			password: config.adminPassword,
			name: 'Admin',
			role: 'admin',
			data: {
				username: config.adminUsername,
				mustChangePassword: true
			}
		}
	});

	console.log(`[logwiz] Default admin created: ${config.adminUsername} / ${config.adminEmail}`);
}

if (!building) {
	await seedDefaultAdmin().catch(console.error);

	try {
		const summaries = await syncIndexesFromQuickwit();
		console.log(`[logwiz] Synced ${summaries.length} indexes from Quickwit`);
	} catch (e) {
		console.warn('[logwiz] Failed to sync indexes from Quickwit:', e);
	}
}

const authLimiter = new RetryAfterRateLimiter({
	IP: [config.signinRateLimitMax, 'm']
});

const AUTH_PATHS = ['/auth/sign-in', '/auth/setup', '/api/auth/sign-in'];

const handleRateLimit: Handle = async ({ event, resolve }) => {
	if (event.request.method === 'POST' && AUTH_PATHS.some((p) => event.url.pathname.startsWith(p))) {
		const status = await authLimiter.check(event);
		if (status.limited) {
			return new Response('Too many requests. Please try again later.', {
				status: 429,
				headers: { 'Retry-After': status.retryAfter.toString() }
			});
		}
	}
	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;

		// Throttled last-active update (at most once per 5 minutes)
		const now = Date.now();
		const lastActive = session.user.lastActive ?? 0;
		if (now - lastActive > 5 * 60 * 1000) {
			db.update(user)
				.set({ lastActive: new Date(now) })
				.where(eq(user.id, session.user.id))
				.run();
		}

		// Force password change if required (skip for Google-authenticated users)
		if (
			session.user.mustChangePassword &&
			!event.url.pathname.startsWith('/auth/change-password') &&
			!event.url.pathname.startsWith('/api/auth')
		) {
			const [googleAccount] = db
				.select({ id: account.id })
				.from(account)
				.where(and(eq(account.userId, session.user.id), eq(account.providerId, 'google')))
				.all();

			if (!googleAccount) {
				return new Response(null, {
					status: 302,
					headers: { Location: '/auth/change-password' }
				});
			}
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

// IMPORTANT: Must be first in sequence() so headers are applied to all responses,
// including 429s from rate limiting and 302 auth redirects.
// Downstream hooks must use `new Response()` (mutable headers), not `Response.redirect()`.
const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Read existing CSP (contains script-src with nonce from kit.csp), then append
	const existingCsp = response.headers.get('content-security-policy') ?? '';
	const additionalCsp = [
		"default-src 'self'",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com",
		"img-src 'self' data:",
		"connect-src 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ');
	response.headers.set(
		'content-security-policy',
		existingCsp ? `${existingCsp}; ${additionalCsp}` : additionalCsp
	);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Strict-Transport-Security', 'max-age=31536000');
	response.headers.set('X-XSS-Protection', '0');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

export const handle = sequence(handleSecurityHeaders, handleRateLimit, handleBetterAuth);
