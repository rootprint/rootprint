import type { Db } from '../db/index.js';
import { searchAudit } from '../db/schema.js';
import { HttpError } from '../utils/http-error.js';
import type { SearchQueryInput } from '../schemas/search.js';
import type { LogSearchResponse } from '../types.js';

const MAX_MSG = 500;

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
type AuditActor = { source: 'ui'; userId: string } | { source: 'token'; apiKeyId: number };

/**
 * Runs a log search, timing it and recording a success/error row in search_audit.
 * The audit insert is fire-and-forget so it never blocks or fails the request.
 */
export async function withSearchAudit(
	db: Db,
	actor: AuditActor,
	indexId: string,
	q: SearchQueryInput,
	run: () => Promise<LogSearchResponse>
): Promise<LogSearchResponse> {
	const start = performance.now();
	const base = { ...actor, indexId, query: q.q ?? '', startTs: q.startTs, endTs: q.endTs };
	try {
		const result = await run();
		db.insert(searchAudit)
			.values({
				...base,
				status: 'success',
				durationMs: Math.round(performance.now() - start),
				numHits: result.numHits
			})
			.catch((err) => console.error('[search_audit] insert failed', err));
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
			.catch((err) => console.error('[search_audit] insert failed', err));
		throw err;
	}
}
