import { randomBytes } from 'node:crypto';
import { generateId } from 'better-auth';
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Db } from '../lib/db.js';
// apikey = Better Auth API key plugin table; referenceId is the owning user id.
import { apikey as personalApiKey, user } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { removeAdminUser } from '../lib/auth-admin.js';
import type { ServiceAccountApiKeySummary, ServiceAccountSummary } from '../types.js';
import { fromAuthApiError, notFound } from '../utils/http-error.js';

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

export async function listServiceAccountKeys(db: Db): Promise<ServiceAccountApiKeySummary[]> {
	const rows = await db
		.select({
			id: personalApiKey.id,
			name: personalApiKey.name,
			start: personalApiKey.start,
			userId: personalApiKey.referenceId,
			userName: user.name,
			lastRequest: personalApiKey.lastRequest,
			createdAt: personalApiKey.createdAt
		})
		.from(personalApiKey)
		.innerJoin(user, eq(personalApiKey.referenceId, user.id))
		.where(eq(user.isServiceAccount, true))
		.orderBy(desc(personalApiKey.createdAt));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		start: r.start,
		userId: r.userId,
		userName: r.userName,
		lastRequest: r.lastRequest?.toISOString() ?? null,
		createdAt: r.createdAt.toISOString()
	}));
}

type CreateApiKeyFn = (opts: {
	body: { name: string; userId: string };
}) => Promise<{ id: string; key: string }>;

export async function createServiceAccountKey(
	db: Db,
	name: string,
	userId: string
): Promise<{ id: string; token: string }> {
	const [owner] = await db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, true)))
		.limit(1);
	if (!owner) throw notFound('Service account not found');
	const createKey = (auth().api as unknown as { createApiKey: CreateApiKeyFn }).createApiKey;
	try {
		const key = await createKey({ body: { name, userId } });
		return { id: key.id, token: key.key };
	} catch (err) {
		throw fromAuthApiError(err, 'Failed to create service account key');
	}
}

export async function deleteServiceAccountKey(db: Db, id: string): Promise<void> {
	const [key] = await db
		.select({ id: personalApiKey.id })
		.from(personalApiKey)
		.innerJoin(user, eq(personalApiKey.referenceId, user.id))
		.where(and(eq(personalApiKey.id, id), eq(user.isServiceAccount, true)))
		.limit(1);
	if (!key) {
		throw notFound('Service account API key not found');
	}

	const result = await db
		.delete(personalApiKey)
		.where(eq(personalApiKey.id, key.id))
		.returning({ id: personalApiKey.id });
	if (result.length === 0) {
		throw notFound('Service account API key not found');
	}
}
