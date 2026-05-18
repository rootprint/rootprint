import { desc, eq, sql } from 'drizzle-orm';
import type {
	CreateSearchTokenInput,
	SearchTokenSummary,
	SearchTokenValue,
	VerifiedSearchToken
} from '../types.js';

import { TOKEN_DISPLAY_PREFIX_LENGTH } from '../constants/tokens.js';
import type { Db } from '../db/index.js';
import { searchToken } from '../db/schema.js';
import { generateSearchToken } from '../utils/search-token.js';
import { internal, notFound } from '../utils/http-error.js';
import { touchLastUsed, withUniqueViolation } from '../utils/db.js';

export async function listSearchTokens(db: Db): Promise<SearchTokenSummary[]> {
	return db
		.select({
			id: searchToken.id,
			name: searchToken.name,
			tokenPrefix: sql<string>`substring(${searchToken.token} for ${TOKEN_DISPLAY_PREFIX_LENGTH})`,
			indexId: searchToken.indexId,
			lastUsedAt: searchToken.lastUsedAt,
			createdAt: searchToken.createdAt,
			createdByUserId: searchToken.createdByUserId
		})
		.from(searchToken)
		.orderBy(desc(searchToken.createdAt));
}

export async function createSearchToken(
	db: Db,
	createdByUserId: string,
	input: CreateSearchTokenInput
): Promise<{ summary: SearchTokenSummary; token: string }> {
	const token = generateSearchToken();
	const [row] = await withUniqueViolation('Token name already exists', 'CONFLICT', () =>
		db
			.insert(searchToken)
			.values({
				name: input.name,
				token,
				indexId: input.indexId,
				createdByUserId
			})
			.returning()
	);
	if (!row) throw internal('Failed to create search token');
	return {
		summary: {
			id: row.id,
			name: row.name,
			tokenPrefix: row.token.slice(0, TOKEN_DISPLAY_PREFIX_LENGTH),
			indexId: row.indexId,
			lastUsedAt: row.lastUsedAt,
			createdAt: row.createdAt,
			createdByUserId: row.createdByUserId
		},
		token
	};
}

export async function deleteSearchToken(db: Db, tokenId: number): Promise<void> {
	const result = await db
		.delete(searchToken)
		.where(eq(searchToken.id, tokenId))
		.returning({ id: searchToken.id });
	if (result.length === 0) {
		throw notFound('Search token not found');
	}
}

export async function getSearchTokenValue(db: Db, tokenId: number): Promise<SearchTokenValue> {
	const [row] = await db
		.select({ token: searchToken.token })
		.from(searchToken)
		.where(eq(searchToken.id, tokenId))
		.limit(1);
	if (!row) throw notFound('Search token not found');
	return { token: row.token };
}

export async function verifySearchToken(
	db: Db,
	token: string
): Promise<VerifiedSearchToken | null> {
	const [row] = await db
		.select({
			id: searchToken.id,
			name: searchToken.name,
			indexId: searchToken.indexId
		})
		.from(searchToken)
		.where(eq(searchToken.token, token))
		.limit(1);
	if (!row) return null;
	touchLastUsed(db, searchToken, row.id);
	return row;
}
