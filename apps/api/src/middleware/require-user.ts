import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';

import { LAST_ACTIVE_THROTTLE_MS } from '../constants/defaults.js';
import { user } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { internal, unauthorized } from '../utils/http-error.js';

// Intentionally unbounded; user cardinality is small in practice and pre-existing pattern.
const lastActiveMap = new Map<string, number>();

function bumpLastActive(userId: string) {
	const now = Date.now();
	const last = lastActiveMap.get(userId) ?? 0;
	if (now - last <= LAST_ACTIVE_THROTTLE_MS) return;
	lastActiveMap.set(userId, now);
	db.update(user)
		.set({ lastActive: new Date(now) })
		.where(eq(user.id, userId))
		.catch(() => {});
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
	let session;
	try {
		session = await auth().api.getSession({ headers: c.req.raw.headers });
	} catch {
		throw internal('Session validation failed');
	}
	if (!session) throw unauthorized('Unauthorized');
	c.set('session', session);
	bumpLastActive(session.user.id);
	await next();
};
