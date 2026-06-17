import { randomBytes } from 'node:crypto';
import { generateId } from 'better-auth';
import { desc, eq, sql } from 'drizzle-orm';

import type { Db } from '../db/index.js';
// apikey = Better Auth API key plugin table; referenceId is the owning user id.
import { apikey as personalApiKey, user } from '../db/schema.js';
import { removeAdminUser } from '../lib/auth-admin.js';
import type { ServiceAccountSummary } from '../types.js';
import { notFound } from '../utils/http-error.js';

export async function listServiceAccounts(db: Db): Promise<ServiceAccountSummary[]> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			createdAt: user.createdAt,
			keyCount: sql<number>`count(${personalApiKey.id})::int`
		})
		.from(user)
		.leftJoin(personalApiKey, eq(personalApiKey.referenceId, user.id))
		.where(eq(user.isServiceAccount, true))
		.groupBy(user.id)
		.orderBy(desc(user.createdAt));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		createdAt: r.createdAt.toISOString(),
		keyCount: r.keyCount
	}));
}

export async function createServiceAccount(db: Db, name: string): Promise<{ id: string }> {
	const id = generateId();
	const email = `svc-${randomBytes(12).toString('hex')}@service.local`;
	await db.insert(user).values({
		id,
		email,
		name,
		emailVerified: true,
		role: 'user',
		isServiceAccount: true
	});
	return { id };
}

export async function removeServiceAccount(
	db: Db,
	userId: string,
	headers: Headers
): Promise<void> {
	const [row] = await db
		.select({ isServiceAccount: user.isServiceAccount })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!row || !row.isServiceAccount) throw notFound('Service account not found');
	await removeAdminUser(userId, headers);
}
