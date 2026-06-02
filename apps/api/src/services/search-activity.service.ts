import { inArray, sql } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { user } from '../db/auth.schema.js';
import { apiKey } from '../db/schema.js';
import type { ActivityWindow } from '../schemas/admin-activity.js';
import type {
	ActorIndexRow,
	ActorSummaryRow,
	LatencyBucket,
	RecentResult,
	SummaryRow,
	TopActorRow,
	VolumeBucket
} from '../types.js';

type WindowResolved = {
	interval: string; // for INTERVAL literal in SQL
	bucketSeconds: number; // seconds per bucket for time series
};

const WINDOWS: Record<ActivityWindow, WindowResolved> = {
	'24h': { interval: '24 hours', bucketSeconds: 5 * 60 },
	'7d': { interval: '7 days', bucketSeconds: 60 * 60 },
	'30d': { interval: '30 days', bucketSeconds: 6 * 60 * 60 }
};

function sinceWindow(interval: string) {
	return sql`now() - ${sql.raw(`INTERVAL '${interval}'`)}`;
}

function toIso(v: Date | string): string {
	return typeof v === 'string' ? new Date(v).toISOString() : v.toISOString();
}

export function resolveWindow(
	w: ActivityWindow | undefined
): WindowResolved & { key: ActivityWindow } {
	const key: ActivityWindow = w ?? '7d';
	return { key, ...WINDOWS[key] };
}

export async function getSummary(db: Db, window: ActivityWindow | undefined): Promise<SummaryRow> {
	const { interval } = resolveWindow(window);
	const result = await db.execute<{
		total: string;
		errors: string;
		p50: string | null;
		p95: string | null;
		p99: string | null;
	}>(sql`
		SELECT
			COUNT(*)::text                                                            AS total,
			COUNT(*) FILTER (WHERE status = 'error')::text                            AS errors,
			percentile_cont(0.5)  WITHIN GROUP (ORDER BY duration_ms)::text           AS p50,
			percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::text           AS p95,
			percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)::text           AS p99
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
	`);
	const r = result.rows[0];
	if (!r) return { totalSearches: 0, errorCount: 0, p50: null, p95: null, p99: null };
	return {
		totalSearches: Number(r.total),
		errorCount: Number(r.errors),
		p50: r.p50 === null ? null : Number(r.p50),
		p95: r.p95 === null ? null : Number(r.p95),
		p99: r.p99 === null ? null : Number(r.p99)
	};
}

export async function getLatencyBuckets(
	db: Db,
	window: ActivityWindow | undefined
): Promise<LatencyBucket[]> {
	const { interval, bucketSeconds } = resolveWindow(window);
	const result = await db.execute<{
		bucket: Date | string;
		count: string;
		p50: string | null;
		p95: string | null;
		p99: string | null;
	}>(sql`
		SELECT
			to_timestamp(floor(extract(epoch FROM executed_at) / ${bucketSeconds}) * ${bucketSeconds}) AS bucket,
			COUNT(*)::text                                                  AS count,
			percentile_cont(0.5)  WITHIN GROUP (ORDER BY duration_ms)::text AS p50,
			percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::text AS p95,
			percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)::text AS p99
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		GROUP BY bucket
		ORDER BY bucket ASC
	`);
	return result.rows.map((r) => ({
		t: toIso(r.bucket),
		count: Number(r.count),
		p50: r.p50 === null ? null : Number(r.p50),
		p95: r.p95 === null ? null : Number(r.p95),
		p99: r.p99 === null ? null : Number(r.p99)
	}));
}

export async function getTopActors(
	db: Db,
	window: ActivityWindow | undefined,
	limit: number
): Promise<TopActorRow[]> {
	const { interval } = resolveWindow(window);
	const result = await db.execute<{
		kind: 'ui' | 'token';
		actor_id: string;
		count: string;
		avg_duration: string;
		errors: string;
		indexes: string[];
	}>(sql`
		SELECT
			source AS kind,
			CASE WHEN source = 'ui' THEN user_id ELSE api_key_id::text END AS actor_id,
			COUNT(*)::text                                  AS count,
			AVG(duration_ms)::text                          AS avg_duration,
			COUNT(*) FILTER (WHERE status = 'error')::text  AS errors,
			ARRAY_AGG(DISTINCT index_id)                    AS indexes
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		GROUP BY source, actor_id
		ORDER BY COUNT(*) DESC
		LIMIT ${limit}
	`);

	// The 'source' column is 'ui' | 'token'; for the UI we expose 'user' | 'apiKey'.
	const rows = result.rows.map((r) => ({
		kind: (r.kind === 'ui' ? 'user' : 'apiKey') as 'user' | 'apiKey',
		id: r.actor_id,
		count: Number(r.count),
		avgDurationMs: Number(r.avg_duration),
		errorCount: Number(r.errors),
		indexes: r.indexes
	}));

	const userIds = rows.filter((r) => r.kind === 'user').map((r) => r.id);
	const apiKeyIds = rows.filter((r) => r.kind === 'apiKey').map((r) => Number(r.id));
	const userLabels = new Map<string, string>();
	const apiKeyLabels = new Map<number, string>();
	if (userIds.length > 0) {
		const rs = await db
			.select({ id: user.id, email: user.email })
			.from(user)
			.where(inArray(user.id, userIds));
		for (const r of rs) userLabels.set(r.id, r.email);
	}
	if (apiKeyIds.length > 0) {
		const rs = await db
			.select({ id: apiKey.id, name: apiKey.name })
			.from(apiKey)
			.where(inArray(apiKey.id, apiKeyIds));
		for (const r of rs) apiKeyLabels.set(r.id, r.name);
	}

	return rows.map((r) => ({
		...r,
		label:
			r.kind === 'user' ? (userLabels.get(r.id) ?? null) : (apiKeyLabels.get(Number(r.id)) ?? null)
	}));
}

type ActorFilter = { kind: 'user'; userId: string } | { kind: 'apiKey'; apiKeyId: number };

function actorPredicate(a: ActorFilter) {
	return a.kind === 'user' ? sql`user_id = ${a.userId}` : sql`api_key_id = ${a.apiKeyId}`;
}

async function resolveActorIdentity(
	db: Db,
	actor: ActorFilter
): Promise<{ displayName: string | null; email: string | null }> {
	if (actor.kind === 'user') {
		const rows = await db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(inArray(user.id, [actor.userId]));
		const u = rows[0];
		return { displayName: u?.name ?? null, email: u?.email ?? null };
	}
	const rows = await db
		.select({ id: apiKey.id, name: apiKey.name })
		.from(apiKey)
		.where(inArray(apiKey.id, [actor.apiKeyId]));
	const t = rows[0];
	return { displayName: t?.name ?? null, email: null };
}

export async function getActorSummary(
	db: Db,
	window: ActivityWindow | undefined,
	actor: ActorFilter
): Promise<ActorSummaryRow> {
	const { interval } = resolveWindow(window);
	const [identity, result] = await Promise.all([
		resolveActorIdentity(db, actor),
		db.execute<{
			total: string;
			errors: string;
			p50: string | null;
			p95: string | null;
			p99: string | null;
		}>(sql`
			SELECT
				COUNT(*)::text                                                  AS total,
				COUNT(*) FILTER (WHERE status = 'error')::text                  AS errors,
				percentile_cont(0.5)  WITHIN GROUP (ORDER BY duration_ms)::text AS p50,
				percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::text AS p95,
				percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)::text AS p99
			FROM search_audit
			WHERE executed_at >= ${sinceWindow(interval)}
			  AND ${actorPredicate(actor)}
		`)
	]);
	const r = result.rows[0];
	if (!r) {
		return {
			totalSearches: 0,
			errorCount: 0,
			p50: null,
			p95: null,
			p99: null,
			displayName: identity.displayName,
			email: identity.email
		};
	}
	return {
		totalSearches: Number(r.total),
		errorCount: Number(r.errors),
		p50: r.p50 === null ? null : Number(r.p50),
		p95: r.p95 === null ? null : Number(r.p95),
		p99: r.p99 === null ? null : Number(r.p99),
		displayName: identity.displayName,
		email: identity.email
	};
}

export async function getActorVolumeBuckets(
	db: Db,
	window: ActivityWindow | undefined,
	actor: ActorFilter
): Promise<VolumeBucket[]> {
	const { interval, bucketSeconds } = resolveWindow(window);
	const result = await db.execute<{ bucket: Date | string; count: string }>(sql`
		SELECT
			to_timestamp(floor(extract(epoch FROM executed_at) / ${bucketSeconds}) * ${bucketSeconds}) AS bucket,
			COUNT(*)::text AS count
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		  AND ${actorPredicate(actor)}
		GROUP BY bucket
		ORDER BY bucket ASC
	`);
	return result.rows.map((r) => ({ t: toIso(r.bucket), count: Number(r.count) }));
}

export async function getActorLatencyBuckets(
	db: Db,
	window: ActivityWindow | undefined,
	actor: ActorFilter
): Promise<LatencyBucket[]> {
	const { interval, bucketSeconds } = resolveWindow(window);
	const result = await db.execute<{
		bucket: Date | string;
		count: string;
		p50: string | null;
		p95: string | null;
		p99: string | null;
	}>(sql`
		SELECT
			to_timestamp(floor(extract(epoch FROM executed_at) / ${bucketSeconds}) * ${bucketSeconds}) AS bucket,
			COUNT(*)::text                                                  AS count,
			percentile_cont(0.5)  WITHIN GROUP (ORDER BY duration_ms)::text AS p50,
			percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms)::text AS p95,
			percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms)::text AS p99
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		  AND ${actorPredicate(actor)}
		GROUP BY bucket
		ORDER BY bucket ASC
	`);
	return result.rows.map((r) => ({
		t: toIso(r.bucket),
		count: Number(r.count),
		p50: r.p50 === null ? null : Number(r.p50),
		p95: r.p95 === null ? null : Number(r.p95),
		p99: r.p99 === null ? null : Number(r.p99)
	}));
}

export async function getUserIndexes(
	db: Db,
	window: ActivityWindow | undefined,
	userId: string
): Promise<ActorIndexRow[]> {
	const { interval } = resolveWindow(window);
	const result = await db.execute<{
		index_id: string;
		count: string;
		avg_duration: string;
		errors: string;
	}>(sql`
		SELECT
			index_id,
			COUNT(*)::text                                  AS count,
			AVG(duration_ms)::text                          AS avg_duration,
			COUNT(*) FILTER (WHERE status = 'error')::text  AS errors
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		  AND user_id = ${userId}
		GROUP BY index_id
		ORDER BY COUNT(*) DESC
	`);
	return result.rows.map((r) => ({
		indexId: r.index_id,
		count: Number(r.count),
		avgDurationMs: Number(r.avg_duration),
		errorCount: Number(r.errors)
	}));
}

export async function getActorRecent(
	db: Db,
	window: ActivityWindow | undefined,
	actor: ActorFilter,
	opts: { offset: number; limit: number; status: 'any' | 'success' | 'error' }
): Promise<RecentResult> {
	const { interval } = resolveWindow(window);
	const statusPred = opts.status === 'any' ? sql`TRUE` : sql`status = ${opts.status}`;

	const totalResult = await db.execute<{ total: string }>(sql`
		SELECT COUNT(*)::text AS total
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		  AND ${actorPredicate(actor)}
		  AND ${statusPred}
	`);
	const total = Number(totalResult.rows[0]?.total ?? 0);

	const rowsResult = await db.execute<{
		id: string;
		executed_at: Date | string;
		index_id: string;
		duration_ms: number;
		num_hits: string | null;
		query: string;
		start_ts: string | null;
		end_ts: string | null;
	}>(sql`
		SELECT id::text, executed_at, index_id, duration_ms, num_hits::text, query,
			start_ts::text, end_ts::text
		FROM search_audit
		WHERE executed_at >= ${sinceWindow(interval)}
		  AND ${actorPredicate(actor)}
		  AND ${statusPred}
		ORDER BY executed_at DESC
		LIMIT ${opts.limit} OFFSET ${opts.offset}
	`);

	return {
		total,
		rows: rowsResult.rows.map((r) => ({
			id: Number(r.id),
			executedAt: toIso(r.executed_at),
			indexId: r.index_id,
			durationMs: r.duration_ms,
			numHits: r.num_hits === null ? null : Number(r.num_hits),
			query: r.query,
			startTs: r.start_ts === null ? null : Number(r.start_ts),
			endTs: r.end_ts === null ? null : Number(r.end_ts)
		}))
	};
}
