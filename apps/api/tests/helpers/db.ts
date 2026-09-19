import { eq } from 'drizzle-orm';

import { inviteToken, session } from '../../src/db/schema.js';
import { reloadAuth } from '../../src/lib/auth.js';
import { db } from '../../src/lib/db.js';
import { invalidateApiKeyCache } from '../../src/services/api-key.service.js';
import { truncateAll } from './db-admin.js';
import { TEST_DATABASE_URL } from './env.js';

/** Empty every table, drop in-process caches, rebuild Better Auth from the now-empty settings. */
export async function resetDb(): Promise<void> {
	await truncateAll(TEST_DATABASE_URL);
	invalidateApiKeyCache();
	await reloadAuth();
}

export async function expireSessions(userId: string): Promise<void> {
	await db
		.update(session)
		.set({ expiresAt: new Date(Date.now() - 3_600_000) })
		.where(eq(session.userId, userId));
}

export async function expireInvite(token: string): Promise<void> {
	await db
		.update(inviteToken)
		.set({ expiresAt: new Date(Date.now() - 1_000) })
		.where(eq(inviteToken.token, token));
}
