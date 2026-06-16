import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import {
	API_KEY_DISPLAY_PREFIX_LENGTH,
	API_KEY_RANDOM_BYTES,
	INGEST_PREFIX,
	LAST_USED_THROTTLE_SECONDS
} from '../constants.js';
import type { Db } from '../db/index.js';
import { auth } from '../lib/auth.js';
// apiKey = custom ingest-key table; personalApiKey = Better Auth plugin table.
import { apiKey, apikey as personalApiKey, user } from '../db/schema.js';
import type {
	ApiKeySummary,
	ApiKeyValue,
	CreateApiKeyInput,
	ServiceAccountApiKeySummary,
	VerifiedApiKey,
	VerifyApiKeyResult
} from '../types.js';
import { fromAuthApiError, internal, notFound } from '../utils/http-error.js';
import { withUniqueViolation } from '../utils/db.js';

function generateApiKey(): string {
	return `${INGEST_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
}

// Fire-and-forget refresh of the API key's lastUsedAt, throttled so a busy key
// doesn't write on every request.
function touchLastUsed(db: Db, id: number): void {
	db.update(apiKey)
		.set({ lastUsedAt: sql`now()` })
		.where(
			and(
				eq(apiKey.id, id),
				or(
					isNull(apiKey.lastUsedAt),
					sql`${apiKey.lastUsedAt} < now() - make_interval(secs => ${LAST_USED_THROTTLE_SECONDS})`
				)
			)
		)
		.catch(() => {});
}

type ApiKeyCacheEntry =
	| { kind: 'miss'; expiresAt: number }
	| { kind: 'hit'; row: VerifiedApiKey; lastTouchAt: number; expiresAt: number };

const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const MAX_CACHE_ENTRIES = 5000;

// In-process only: under horizontal scaling each instance keeps its own cache, so an
// invalidation on one instance does not reach the others (entries expire via TTL).
const apiKeyCache = new Map<string, ApiKeyCacheEntry>();

export function invalidateApiKeyCache(): void {
	apiKeyCache.clear();
}

function setCacheEntry(token: string, entry: ApiKeyCacheEntry): void {
	// FIFO eviction guard: bounds memory against a flood of distinct bad tokens.
	if (!apiKeyCache.has(token) && apiKeyCache.size >= MAX_CACHE_ENTRIES) {
		const oldest = apiKeyCache.keys().next().value;
		if (oldest !== undefined) apiKeyCache.delete(oldest);
	}
	apiKeyCache.set(token, entry);
}

function resolveHit(
	db: Db,
	entry: Extract<ApiKeyCacheEntry, { kind: 'hit' }>,
	now: number
): VerifyApiKeyResult {
	if (now - entry.lastTouchAt > LAST_USED_THROTTLE_SECONDS * 1000) {
		entry.lastTouchAt = now;
		touchLastUsed(db, entry.row.id);
	}
	return { status: 'ok', key: entry.row };
}

function toApiKeySummary(
	row: Omit<typeof apiKey.$inferSelect, 'token'>,
	tokenPrefix: string
): ApiKeySummary {
	return {
		id: row.id,
		name: row.name,
		tokenPrefix,
		role: row.role,
		indexId: row.indexId,
		lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		createdByUserId: row.createdByUserId
	};
}

export async function listApiKeys(db: Db): Promise<ApiKeySummary[]> {
	const base = db
		.select({
			id: apiKey.id,
			name: apiKey.name,
			tokenPrefix: sql<string>`substring(${apiKey.token} for ${API_KEY_DISPLAY_PREFIX_LENGTH})`,
			role: apiKey.role,
			indexId: apiKey.indexId,
			lastUsedAt: apiKey.lastUsedAt,
			createdAt: apiKey.createdAt,
			createdByUserId: apiKey.createdByUserId
		})
		.from(apiKey);
	const rows = await base.orderBy(desc(apiKey.createdAt));
	return rows.map((row) => toApiKeySummary(row, row.tokenPrefix));
}

export async function createApiKey(
	db: Db,
	createdByUserId: string,
	input: CreateApiKeyInput
): Promise<{ summary: ApiKeySummary; token: string }> {
	const token = generateApiKey();
	const [row] = await withUniqueViolation('API key name already exists', 'CONFLICT', () =>
		db
			.insert(apiKey)
			.values({
				name: input.name,
				token,
				role: 'ingest',
				indexId: input.indexId,
				createdByUserId
			})
			.returning()
	);
	if (!row) throw internal('Failed to create API key');
	invalidateApiKeyCache();
	return {
		summary: toApiKeySummary(row, row.token.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH)),
		token
	};
}

export async function getApiKeyValue(db: Db, id: number): Promise<ApiKeyValue> {
	const [row] = await db
		.select({ token: apiKey.token })
		.from(apiKey)
		.where(eq(apiKey.id, id))
		.limit(1);
	if (!row) throw notFound('API key not found');
	return { token: row.token };
}

export async function deleteApiKey(db: Db, id: number): Promise<void> {
	const result = await db.delete(apiKey).where(eq(apiKey.id, id)).returning({ id: apiKey.id });
	if (result.length === 0) {
		throw notFound('API key not found');
	}
	invalidateApiKeyCache();
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
		// Admin keys page surfaces service-account keys only; humans manage their own.
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

export async function verifyApiKey(db: Db, bearer: string): Promise<VerifyApiKeyResult> {
	const now = Date.now();

	const cached = apiKeyCache.get(bearer);
	if (cached && now < cached.expiresAt) {
		if (cached.kind === 'miss') return { status: 'not-found' };
		return resolveHit(db, cached, now);
	}

	const [row] = await db
		.select({
			id: apiKey.id,
			name: apiKey.name,
			indexId: apiKey.indexId,
			role: apiKey.role
		})
		.from(apiKey)
		.where(eq(apiKey.token, bearer))
		.limit(1);

	if (!row) {
		setCacheEntry(bearer, { kind: 'miss', expiresAt: now + NEGATIVE_TTL_MS });
		return { status: 'not-found' };
	}

	// lastTouchAt: 0 forces the first resolveHit to fire the lastUsedAt write.
	const entry: ApiKeyCacheEntry = {
		kind: 'hit',
		row,
		lastTouchAt: 0,
		expiresAt: now + POSITIVE_TTL_MS
	};
	setCacheEntry(bearer, entry);
	return resolveHit(db, entry, now);
}
