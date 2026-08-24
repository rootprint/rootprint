import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';

import {
	API_KEY_DISPLAY_PREFIX_LENGTH,
	API_KEY_RANDOM_BYTES,
	INGEST_PREFIX,
	LAST_USED_THROTTLE_SECONDS
} from '../constants.js';
import type { Db } from '../db/index.js';
import { config } from '../config.js';
// apiKey = the custom ingest-key table, not Better Auth's own apikey table.
import { apiKey } from '../db/schema.js';
import type {
	ApiKeySummary,
	ApiKeyValue,
	CreateApiKeyInput,
	VerifiedApiKey,
	VerifyApiKeyResult
} from '../types.js';
import { badRequest, internal, notFound } from '../utils/http-error.js';
import { withUniqueViolation } from '../utils/db.js';

function generateApiKey(): string {
	return `${INGEST_PREFIX}${randomBytes(API_KEY_RANDOM_BYTES).toString('hex')}`;
}

// Fire-and-forget refresh of the API key's lastUsedAt. Fires once per cache entry;
// the SQL predicate bounds the writes when a cache invalidation makes every in-flight
// request re-resolve at once.
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
	{ kind: 'miss'; expiresAt: number } | { kind: 'hit'; row: VerifiedApiKey; expiresAt: number };

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

function toApiKeySummary(
	row: Omit<typeof apiKey.$inferSelect, 'token'>,
	tokenPrefix: string
): ApiKeySummary {
	return {
		id: row.id,
		name: row.name,
		tokenPrefix,
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
	if (input.indexId === config.traceIndexId) {
		throw badRequest('That index is a trace index.', 'INDEX_IS_TRACE_INDEX', [
			{ path: 'indexId', message: 'Pick a log index.' }
		]);
	}

	const token = generateApiKey();
	const [row] = await withUniqueViolation('API key name already exists', 'CONFLICT', () =>
		db
			.insert(apiKey)
			.values({
				name: input.name,
				token,
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

export async function verifyApiKey(db: Db, bearer: string): Promise<VerifyApiKeyResult> {
	const now = Date.now();

	const cached = apiKeyCache.get(bearer);
	if (cached && now < cached.expiresAt) {
		return cached.kind === 'miss' ? { status: 'not-found' } : { status: 'ok', key: cached.row };
	}

	const [row] = await db
		.select({
			id: apiKey.id,
			name: apiKey.name,
			indexId: apiKey.indexId
		})
		.from(apiKey)
		.where(eq(apiKey.token, bearer))
		.limit(1);

	if (!row) {
		setCacheEntry(bearer, { kind: 'miss', expiresAt: now + NEGATIVE_TTL_MS });
		return { status: 'not-found' };
	}

	setCacheEntry(bearer, { kind: 'hit', row, expiresAt: now + POSITIVE_TTL_MS });
	touchLastUsed(db, row.id);
	return { status: 'ok', key: row };
}
