import { sql } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { searchAudit } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/http-error.js';

const MAX_MSG = 500;

export async function pruneSearchAudit(db: Db, retentionDays: number): Promise<void> {
	await db
		.delete(searchAudit)
		.where(sql`${searchAudit.executedAt} < now() - make_interval(days => ${retentionDays})`);
}

function extractAuditError(err: unknown): { code: string; message: string } {
	if (err instanceof HttpError) {
		return { code: err.code, message: err.message.slice(0, MAX_MSG) };
	}
	if (err instanceof Error) {
		return { code: 'UNKNOWN', message: err.message.slice(0, MAX_MSG) };
	}
	return { code: 'UNKNOWN', message: 'unknown error' };
}

// Discriminated by who issued the search — the search_audit check constraint
// enforces the matching (source, userId/apiKeyId) shape, so the two are tied
// together here rather than passed as loose fields.
type AuditActor = { source: 'ui'; userId: string } | { source: 'token'; apiKeyId: string };

export function auditActor(userId: string, apiKeyId?: string): AuditActor {
	return apiKeyId === undefined ? { source: 'ui', userId } : { source: 'token', apiKeyId };
}

type SearchAuditMetadata = {
	query: string;
	startTs?: number;
	endTs?: number;
};

/**
 * Runs a search, timing it and recording a success/error row in search_audit.
 * The audit insert is fire-and-forget so it never blocks or fails the request.
 */
export async function withSearchAudit<Result>(
	db: Db,
	actor: AuditActor,
	indexId: string,
	metadata: SearchAuditMetadata,
	run: () => Promise<Result>,
	resultCount: (result: Result) => number | null = () => null
): Promise<Result> {
	const start = performance.now();
	const base = {
		...actor,
		indexId,
		query: metadata.query,
		startTs: metadata.startTs === undefined ? undefined : Math.trunc(metadata.startTs),
		endTs: metadata.endTs === undefined ? undefined : Math.trunc(metadata.endTs)
	};
	try {
		const result = await run();
		db.insert(searchAudit)
			.values({
				...base,
				status: 'success',
				durationMs: Math.round(performance.now() - start),
				numHits: resultCount(result)
			})
			.catch((insertErr) =>
				logger.error({ err: insertErr, indexId }, 'search audit insert failed')
			);
		return result;
	} catch (err) {
		const { code, message } = extractAuditError(err);
		db.insert(searchAudit)
			.values({
				...base,
				status: 'error',
				durationMs: Math.round(performance.now() - start),
				errorCode: code,
				errorMessage: message
			})
			.catch((insertErr) =>
				logger.error({ err: insertErr, indexId }, 'search audit insert failed')
			);
		throw err;
	}
}
