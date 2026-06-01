import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import {
	API_KEY_DISPLAY_PREFIX_LENGTH,
	API_KEY_RANDOM_BYTES,
	INGEST_PREFIX,
	LAST_USED_THROTTLE_SECONDS,
	SEARCH_PREFIX
} from '../constants.js';
import type { Db } from '../db/index.js';
import { apiKey } from '../db/schema.js';
import type {
	ApiKeyRole,
	ApiKeySummary,
	ApiKeyValue,
	CreateApiKeyInput,
	VerifiedApiKey,
	VerifyApiKeyResult
} from '../types.js';
import { internal, notFound } from '../utils/http-error.js';
import { withUniqueViolation } from '../utils/db.js';

function generateApiKey(role: ApiKeyRole): string {
	const prefix = role === 'ingest' ? INGEST_PREFIX : SEARCH_PREFIX;
	return `${prefix}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
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
	expectedRole: ApiKeyRole,
	now: number
): VerifyApiKeyResult {
	if (entry.row.role !== expectedRole) {
		return { status: 'wrong-role', actualRole: entry.row.role };
	}
	if (now - entry.lastTouchAt > LAST_USED_THROTTLE_SECONDS * 1000) {
		entry.lastTouchAt = now;
		touchLastUsed(db, entry.row.id);
	}
	return { status: 'ok', key: entry.row };
}

export async function listApiKeys(
	db: Db,
	opts: { role?: ApiKeyRole } = {}
): Promise<ApiKeySummary[]> {
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
	const filtered = opts.role ? base.where(eq(apiKey.role, opts.role)) : base;
	return filtered.orderBy(desc(apiKey.createdAt));
}

export async function createApiKey(
	db: Db,
	createdByUserId: string,
	input: CreateApiKeyInput
): Promise<{ summary: ApiKeySummary; token: string }> {
	const token = generateApiKey(input.role);
	const [row] = await withUniqueViolation('API key name already exists', 'CONFLICT', () =>
		db
			.insert(apiKey)
			.values({
				name: input.name,
				token,
				role: input.role,
				indexId: input.indexId,
				createdByUserId
			})
			.returning()
	);
	if (!row) throw internal('Failed to create API key');
	invalidateApiKeyCache();
	return {
		summary: {
			id: row.id,
			name: row.name,
			tokenPrefix: row.token.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
			role: row.role,
			indexId: row.indexId,
			lastUsedAt: row.lastUsedAt,
			createdAt: row.createdAt,
			createdByUserId: row.createdByUserId
		},
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

export async function verifyApiKey(
	db: Db,
	bearer: string,
	expectedRole: ApiKeyRole
): Promise<VerifyApiKeyResult> {
	const now = Date.now();

	const cached = apiKeyCache.get(bearer);
	if (cached && now < cached.expiresAt) {
		if (cached.kind === 'miss') return { status: 'not-found' };
		return resolveHit(db, cached, expectedRole, now);
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
	return resolveHit(db, entry, expectedRole, now);
}
