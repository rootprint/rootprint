import { desc, eq } from 'drizzle-orm';

import { TOKEN_PREFIX_LENGTH } from '$lib/constants/ingest';
import type { CreateIngestTokenInput } from '$lib/schemas/ingest-tokens';
import { db } from '$lib/server/db';
import { ingestToken } from '$lib/server/db/schema';
import { generateIngestToken } from '$lib/server/utils/ingest-token';
import type { IngestTokenSummary, VerifiedIngestToken } from '$lib/types';

type TokenRow = typeof ingestToken.$inferSelect;

function mapIngestTokenSummary(row: TokenRow): IngestTokenSummary {
	return {
		id: row.id,
		name: row.name,
		tokenPrefix: row.token.slice(0, TOKEN_PREFIX_LENGTH),
		indexId: row.indexId,
		lastUsedAt: row.lastUsedAt,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId
	};
}

export function listIngestTokens(): IngestTokenSummary[] {
	const rows = db.select().from(ingestToken).all();
	return rows.map(mapIngestTokenSummary);
}

export function createIngestToken(
	createdByUserId: string,
	input: CreateIngestTokenInput
): IngestTokenSummary {
	const token = generateIngestToken();
	db.insert(ingestToken)
		.values({
			name: input.name,
			token,
			indexId: input.indexId,
			createdByUserId
		})
		.run();

	const [created] = db.select().from(ingestToken).where(eq(ingestToken.token, token)).all();
	if (!created) {
		throw new Error('Failed to create ingest token');
	}

	return mapIngestTokenSummary(created);
}

export function deleteIngestToken(tokenId: number): void {
	const [existing] = db
		.select({ id: ingestToken.id })
		.from(ingestToken)
		.where(eq(ingestToken.id, tokenId))
		.all();
	if (!existing) {
		throw new Error('Ingest token not found');
	}
	db.delete(ingestToken).where(eq(ingestToken.id, tokenId)).run();
}

export function getIngestTokenValue(tokenId: number): { token: string } {
	const [row] = db
		.select({ token: ingestToken.token })
		.from(ingestToken)
		.where(eq(ingestToken.id, tokenId))
		.all();
	if (!row) {
		throw new Error('Ingest token not found');
	}
	return { token: row.token };
}

export function verifyIngestToken(token: string): VerifiedIngestToken | null {
	const [record] = db.select().from(ingestToken).where(eq(ingestToken.token, token)).all();
	if (!record) return null;

	const now = Date.now();
	const lastUsed = record.lastUsedAt?.getTime() ?? 0;
	if (now - lastUsed > 60 * 1000) {
		db.update(ingestToken)
			.set({ lastUsedAt: new Date(now) })
			.where(eq(ingestToken.id, record.id))
			.run();
	}

	return { id: record.id, name: record.name, indexId: record.indexId };
}

export function getLatestIngestTokenForIndex(indexId: string): string | null {
	const [row] = db
		.select({ token: ingestToken.token })
		.from(ingestToken)
		.where(eq(ingestToken.indexId, indexId))
		.orderBy(desc(ingestToken.createdAt))
		.limit(1)
		.all();
	return row?.token ?? null;
}
