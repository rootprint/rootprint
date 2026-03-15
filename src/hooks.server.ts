import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import { RetryAfterRateLimiter } from 'sveltekit-rate-limiter/server';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function seedDefaultAdmin() {
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
		.limit(1);
	if (existing) return;

	await auth.api.createUser({
		body: {
			email: 'logwiz@logwiz.local',
			password: 'logwiz',
			name: 'Admin',
			role: 'admin',
			data: {
				username: 'logwiz',
				mustChangePassword: true
			}
		}
	});

	console.log('Default admin created: logwiz / logwiz');
}

if (!building) {
	seedDefaultAdmin().catch(console.error);
}

const authLimiter = new RetryAfterRateLimiter({
	IP: [5, 'm']
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

export const handle = sequence(handleRateLimit, handleBetterAuth);
