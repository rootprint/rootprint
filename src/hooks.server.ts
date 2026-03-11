import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { hashPassword } from 'better-auth/crypto';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { user, account } from '$lib/server/db/schema';
import { count } from 'drizzle-orm';

async function seedDefaultAdmin() {
	const [{ total }] = await db.select({ total: count() }).from(user);
	if (total > 0) return;

	const email = env.DEFAULT_ADMIN_EMAIL ?? 'logwiz@logwiz.local';
	const password = env.DEFAULT_ADMIN_PASSWORD ?? 'logwiz123';

	const userId = crypto.randomUUID();
	const hashedPassword = await hashPassword(password);

	await db.insert(user).values({
		id: userId,
		name: 'Admin',
		email,
		role: 'admin'
	});

	await db.insert(account).values({
		id: crypto.randomUUID(),
		accountId: userId,
		providerId: 'credential',
		userId,
		password: hashedPassword
	});

	console.log(`Default admin created: ${email}`);
}

if (!building) {
	seedDefaultAdmin().catch(console.error);
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
