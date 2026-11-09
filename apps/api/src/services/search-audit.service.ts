import { sql } from 'drizzle-orm';
import type { Context } from 'hono';

import { config } from '../config.js';
import type { AuthedEnv } from '../env.js';
import { db, type Db } from '../lib/db.js';
import { searchAudit } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { isHangup, quickwit } from '../lib/quickwit/client.js';
import type { LogSearchResponse } from '../schemas/responses/indexes.js';
import type {
	ServiceErrorsResponse,
	ServiceHealthResponse
} from '../schemas/responses/services.js';
import type { ExploreOverviewResponse, ExploreSpansResponse } from '../schemas/responses/traces.js';
import type { SearchQueryInput } from '../schemas/search.js';
import type { ServiceErrorsInput, ServiceHealthInput } from '../schemas/services.js';
import type { ExploreFilters, ExploreOverviewInput, ExploreSpansInput } from '../schemas/traces.js';
import type { TraceResponse } from '../types.js';
import { badRequest, HttpError } from '../utils/http-error.js';
import type { IndexConfig } from './index.service.js';
import { searchLogs } from './log.service.js';
import {
	getServiceErrors,
	getServiceHealth,
	serviceErrorsQuery,
	serviceHealthQuery
} from './service-health.service.js';
import { exploreQuery, getExploreOverview, getExploreSpans } from './trace-explore.service.js';
import { getTrace } from './trace.service.js';

const MAX_MSG = 500;

export async function pruneSearchAudit(db: Db, retentionDays: number): Promise<number> {
	const result = await db
		.delete(searchAudit)
		.where(sql`${searchAudit.executedAt} < now() - make_interval(days => ${retentionDays})`);
	return result.rowCount ?? 0;
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
export type AuditActor = { source: 'ui'; userId: string } | { source: 'token'; apiKeyId: string };

export function actorOf<E extends AuthedEnv>(c: Context<E>): AuditActor {
	const apiKeyId = c.get('apiKeyActor')?.keyId;
	return apiKeyId === undefined
		? { source: 'ui', userId: c.get('session').user.id }
		: { source: 'token', apiKeyId };
}

type SearchAuditMetadata = {
	query: string;
	startTs?: number;
	endTs?: number;
};

/**
 * Runs a search, timing it and recording a success, error or cancelled row in search_audit.
 * Cancelled means the client hung up; its row carries no error and stays out of activity stats.
 * The audit insert is fire-and-forget so it never blocks or fails the request.
 */
async function withSearchAudit<Result>(
	actor: AuditActor,
	indexId: string,
	metadata: SearchAuditMetadata,
	run: () => Promise<Result>,
	resultCount: (result: Result) => number | null
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
				logger.error(
					{ err: insertErr, 'rootprint.index.id': indexId },
					'search audit insert failed'
				)
			);
		return result;
	} catch (err) {
		const failure = isHangup(err) ? null : extractAuditError(err);
		db.insert(searchAudit)
			.values({
				...base,
				status: failure ? 'error' : 'cancelled',
				durationMs: Math.round(performance.now() - start),
				errorCode: failure?.code,
				errorMessage: failure?.message
			})
			.catch((insertErr) =>
				logger.error(
					{ err: insertErr, 'rootprint.index.id': indexId },
					'search audit insert failed'
				)
			);
		throw err;
	}
}

// The read* operations below are the only way to run an audited search, so the HTTP routes and the
// MCP tools share one set of cross-field checks. Checks throw before the audit: rejected input is
// never recorded.

function checkWindow({ startTs, endTs }: { startTs: number; endTs: number }): void {
	if (startTs >= endTs) throw badRequest('startTs must be before endTs');
}

function checkExploreFilters(params: ExploreFilters): void {
	checkWindow(params);
	const { minMs, maxMs } = params;
	if (minMs !== undefined && maxMs !== undefined && minMs >= maxMs) {
		throw badRequest('minMs must be below maxMs');
	}
}

export function readLogs(
	actor: AuditActor,
	indexConfig: IndexConfig,
	params: SearchQueryInput
): Promise<LogSearchResponse> {
	const { startTs, endTs } = params;
	if (startTs !== undefined && endTs !== undefined) checkWindow({ startTs, endTs });
	return withSearchAudit(
		actor,
		indexConfig.indexId,
		{ query: params.q ?? '', startTs: params.startTs, endTs: params.endTs },
		() => searchLogs(quickwit, indexConfig, params),
		(r) => r.numHits
	);
}

export function readExploreOverview(
	actor: AuditActor,
	params: ExploreOverviewInput
): Promise<ExploreOverviewResponse> {
	checkExploreFilters(params);
	return withSearchAudit(
		actor,
		config.traceIndexId,
		{ query: exploreQuery(params), startTs: params.startTs, endTs: params.endTs },
		() => getExploreOverview(quickwit, config.traceIndexId, params),
		(r) => r.summary.spans
	);
}

export function readExploreSpans(
	actor: AuditActor,
	params: ExploreSpansInput
): Promise<ExploreSpansResponse> {
	checkExploreFilters(params);
	return withSearchAudit(
		actor,
		config.traceIndexId,
		{ query: exploreQuery(params), startTs: params.startTs, endTs: params.endTs },
		() => getExploreSpans(quickwit, config.traceIndexId, params),
		(r) => r.total
	);
}

export function readTrace(actor: AuditActor, traceId: string): Promise<TraceResponse> {
	return withSearchAudit(
		actor,
		config.traceIndexId,
		{ query: `trace_id:${traceId}` },
		() => getTrace(quickwit, config.traceIndexId, traceId),
		(r) => r.spans.length
	);
}

export function readServiceHealth(
	actor: AuditActor,
	params: ServiceHealthInput
): Promise<ServiceHealthResponse> {
	checkWindow(params);
	return withSearchAudit(
		actor,
		config.traceIndexId,
		{ query: serviceHealthQuery(params.service), startTs: params.startTs, endTs: params.endTs },
		() => getServiceHealth(quickwit, config.traceIndexId, params),
		(r) => r.summary.requests
	);
}

export function readServiceErrors(
	actor: AuditActor,
	params: ServiceErrorsInput
): Promise<ServiceErrorsResponse> {
	checkWindow(params);
	return withSearchAudit(
		actor,
		config.traceIndexId,
		{ query: serviceErrorsQuery(params), startTs: params.startTs, endTs: params.endTs },
		() => getServiceErrors(quickwit, config.traceIndexId, params),
		(r) => r.rows.length
	);
}
