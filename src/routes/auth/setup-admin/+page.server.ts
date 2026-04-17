import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

export async function load() {
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
		.limit(1);
	if (existing) {
		redirect(302, '/auth/sign-in');
	}
	return {};
}
