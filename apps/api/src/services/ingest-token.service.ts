import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { CreateIngestTokenInput, IngestTokenSummary, IngestTokenValue } from '../types.js';

import type { Logger } from '../lib/logger.js';

import { LAST_USED_THROTTLE_SECONDS, TOKEN_DISPLAY_PREFIX_LENGTH } from '../constants/ingest.js';
import type { Db } from '../db/index.js';
import { ingestToken } from '../db/schema.js';
import { generateIngestToken } from '../utils/ingest-token.js';
import { conflict, internal, isUniqueViolation, notFound } from '../utils/http-error.js';

export type VerifiedIngestToken = {
	id: number;
	name: string;
	indexId: string;
};

export async function listIngestTokens(db: Db): Promise<IngestTokenSummary[]> {
	return db
		.select({
			id: ingestToken.id,
			name: ingestToken.name,
			tokenPrefix: sql<string>`substring(${ingestToken.token} for ${TOKEN_DISPLAY_PREFIX_LENGTH})`,
			indexId: ingestToken.indexId,
			lastUsedAt: ingestToken.lastUsedAt,
			createdAt: ingestToken.createdAt,
			createdByUserId: ingestToken.createdByUserId
		})
		.from(ingestToken)
		.orderBy(desc(ingestToken.createdAt));
}

export async function createIngestToken(
	db: Db,
	createdByUserId: string,
	input: CreateIngestTokenInput
): Promise<{ summary: IngestTokenSummary; token: string }> {
	const token = generateIngestToken();
	try {
		const [row] = await db
			.insert(ingestToken)
			.values({
				name: input.name,
				token,
				indexId: input.indexId,
				createdByUserId
			})
			.returning();
		if (!row) throw internal('Failed to create ingest token');
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
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw conflict('Token name already exists');
		}
		throw err;
	}
}

export async function deleteIngestToken(db: Db, tokenId: number): Promise<void> {
	const result = await db
		.delete(ingestToken)
		.where(eq(ingestToken.id, tokenId))
		.returning({ id: ingestToken.id });
	if (result.length === 0) {
		throw notFound('Ingest token not found');
	}
}

export async function getIngestTokenValue(db: Db, tokenId: number): Promise<IngestTokenValue> {
	const [row] = await db
		.select({ token: ingestToken.token })
		.from(ingestToken)
		.where(eq(ingestToken.id, tokenId))
		.limit(1);
	if (!row) throw notFound('Ingest token not found');
	return { token: row.token };
}

export async function verifyIngestToken(
	db: Db,
	log: Logger,
	token: string
): Promise<VerifiedIngestToken | null> {
	const [row] = await db
		.select({
			id: ingestToken.id,
			name: ingestToken.name,
			indexId: ingestToken.indexId
		})
		.from(ingestToken)
		.where(eq(ingestToken.token, token))
		.limit(1);
	if (!row) return null;
	touchLastUsed(db, log, row.id);
	return row;
}

function touchLastUsed(db: Db, log: Logger, tokenId: number): void {
	db.update(ingestToken)
		.set({ lastUsedAt: sql`now()` })
		.where(
			and(
				eq(ingestToken.id, tokenId),
				or(
					isNull(ingestToken.lastUsedAt),
					sql`${ingestToken.lastUsedAt} < now() - make_interval(secs => ${LAST_USED_THROTTLE_SECONDS})`
				)
			)
		)
		.catch((err) => log.warn({ err, tokenId }, 'lastUsedAt update failed'));
}
