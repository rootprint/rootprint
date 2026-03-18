import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { RetryAfterRateLimiter } from 'sveltekit-rate-limiter/server';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { config, validateConfig } from '$lib/server/config';
import { syncIndexesFromQuickwit } from '$lib/server/sync';

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
	validateConfig();

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

		// Force password change if required
		if (
			session.user.mustChangePassword &&
			!event.url.pathname.startsWith('/auth/change-password') &&
			!event.url.pathname.startsWith('/api/auth')
		) {
			return new Response(null, {
				status: 302,
				headers: { Location: '/auth/change-password' }
			});
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
		"connect-src 'self' https://api.iconify.design",
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
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	response.headers.set('X-XSS-Protection', '0');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};

export const handle = sequence(handleSecurityHeaders, handleRateLimit, handleBetterAuth);
