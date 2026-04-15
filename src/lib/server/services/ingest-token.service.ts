import { eq } from 'drizzle-orm';

import type { CreateIngestTokenInput } from '$lib/schemas/ingest-tokens';
import { db } from '$lib/server/db';
import { ingestToken } from '$lib/server/db/schema';
import {
	generateIngestTokenCredentials,
	hashIngestToken,
	isIngestScopeAllowed
} from '$lib/server/utils/ingest-token';
import type { CreateIngestTokenResult, IngestTokenSummary } from '$lib/types';

type TokenRow = typeof ingestToken.$inferSelect;

function mapIngestTokenSummary(row: TokenRow): IngestTokenSummary {
	return {
		id: row.id,
		name: row.name,
		tokenPrefix: row.tokenPrefix,
		scope: { indexIds: row.indexAllowlist ?? null },
		lastUsedAt: row.lastUsedAt,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId
	};
}

function normalizeScope(indexIds: string[] | undefined): string[] | null {
	if (!indexIds || indexIds.length === 0) return null;
	const deduped = Array.from(new Set(indexIds.map((id) => id.trim()).filter(Boolean)));
	return deduped.length > 0 ? deduped : null;
}

export function listIngestTokens(): IngestTokenSummary[] {
	const rows = db.select().from(ingestToken).all();
	return rows.map(mapIngestTokenSummary);
}

export function createIngestToken(
	createdByUserId: string,
	input: CreateIngestTokenInput
): CreateIngestTokenResult {
	const credentials = generateIngestTokenCredentials();
	db.insert(ingestToken)
		.values({
			name: input.name,
			tokenHash: credentials.tokenHash,
			tokenPrefix: credentials.tokenPrefix,
			indexAllowlist: normalizeScope(input.indexIds),
			createdByUserId
		})
		.run();

	const [created] = db
		.select()
		.from(ingestToken)
		.where(eq(ingestToken.tokenHash, credentials.tokenHash))
		.all();
	if (!created) {
		throw new Error('Failed to create ingest token');
	}

	return {
		token: credentials.token,
		summary: mapIngestTokenSummary(created)
	};
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

export function verifyIngestToken(
	token: string,
	indexId: string
): { id: number; name: string } | null {
	const tokenHash = hashIngestToken(token);
	const [record] = db.select().from(ingestToken).where(eq(ingestToken.tokenHash, tokenHash)).all();
	if (!record) return null;
	if (!isIngestScopeAllowed(record.indexAllowlist ?? null, indexId)) return null;

	// Throttled last-used update (at most once per minute)
	const now = Date.now();
	const lastUsed = record.lastUsedAt?.getTime() ?? 0;
	if (now - lastUsed > 60 * 1000) {
		db.update(ingestToken)
			.set({ lastUsedAt: new Date(now) })
			.where(eq(ingestToken.id, record.id))
			.run();
	}

	return { id: record.id, name: record.name };
}
