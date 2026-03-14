import { command } from '$app/server';
import { db } from '$lib/server/db';
import { indexConfig } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	searchLogsSchema,
	searchFieldValuesSchema,
	searchLogHistogramSchema,
	pollLiveLogsSchema
} from '$lib/schemas/logs';
import {
	computeHistogramInterval,
	computeHistogramIntervalSeconds,
	padHistogramBuckets
} from '$lib/utils/histogram';
import { AggregationBuilder } from 'quickwit-js';
import { requireUser } from '$lib/middleware/auth';
import { getQuickwitClient } from '$lib/server/quickwit';
import { resolveTimeRange } from '$lib/utils/time';
import { formatFieldValue } from '$lib/utils/field-resolver';

function resolveTimestamps(data: {
	startTimestamp?: number;
	endTimestamp?: number;
	timeRange?: string;
}): { startTs: number; endTs: number } {
	const hasStart = data.startTimestamp !== undefined;
	const hasEnd = data.endTimestamp !== undefined;

	// Both absolute timestamps provided — use them
	if (hasStart && hasEnd) {
		return { startTs: data.startTimestamp!, endTs: data.endTimestamp! };
	}

	// Partial absolute input — reject, don't silently fall back
	if (hasStart !== hasEnd) {
		throw new Error('Both startTimestamp and endTimestamp must be provided together');
	}

	// Relative preset — validated by schema picklist, but defend against unknown presets
	const preset = data.timeRange ?? '15m';
	const resolved = resolveTimeRange({ type: 'relative', preset });
	if (resolved.startTs === undefined || resolved.endTs === undefined) {
		throw new Error(`Unknown time range preset: ${preset}`);
	}
	return { startTs: resolved.startTs, endTs: resolved.endTs };
}

async function resolveFieldConfig(indexName: string) {
	const [config] = await db.select().from(indexConfig).where(eq(indexConfig.indexName, indexName));

	return {
		levelField: config?.levelField ?? 'level',
		timestampField: config?.timestampField ?? 'timestamp',
		messageField: config?.messageField ?? 'message'
	};
}

export const searchLogs = command(searchLogsSchema, async (data) => {
	requireUser();

	const fields = await resolveFieldConfig(data.indexName);
	const client = getQuickwitClient();
	const index = client.index(data.indexName);

	const { startTs, endTs } = resolveTimestamps(data);

	let query = index
		.query(data.query || '*')
		.limit(data.limit)
		.offset(data.offset)
		.sortBy(`+${fields.timestampField}`);

	query.timeRange(startTs, endTs);

	let filterFields = data.quickFilterFields ?? [];
	const unsupportedFilterFields: string[] = [];

	// Retry loop: if a field isn't a fast field, remove it and retry
	while (true) {
		for (const field of filterFields) {
			query.agg(field, AggregationBuilder.terms(field, { size: 50 }));
		}

		try {
			const result = await index.search(query);

			const aggregations: Record<string, string[]> = {};
			if (result.aggregations) {
				for (const [field, agg] of Object.entries(result.aggregations)) {
					const bucketAgg = agg as { buckets?: { key: string }[] };
					if (bucketAgg.buckets) {
						aggregations[field] = bucketAgg.buckets.map((b) => formatFieldValue(b.key));
					}
				}
			}

			return {
				hits: result.hits,
				numHits: result.num_hits,
				startTimestamp: startTs,
				endTimestamp: endTs,
				aggregations,
				unsupportedFilterFields
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : '';
			const match = msg.match(/Field "(.+?)" is not configured as a fast field/);
			if (match) {
				const badField = match[1];
				unsupportedFilterFields.push(badField);
				filterFields = filterFields.filter((f) => f !== badField);
				// Rebuild query without the bad field's aggregation
				query = index
					.query(data.query || '*')
					.limit(data.limit)
					.offset(data.offset)
					.sortBy(`+${fields.timestampField}`);
				query.timeRange(startTs, endTs);
				continue;
			}
			throw e;
		}
	}
});

export const searchFieldValues = command(searchFieldValuesSchema, async (data) => {
	requireUser();

	const client = getQuickwitClient();
	const index = client.index(data.indexName);

	const baseQuery = data.query?.trim();
	const combinedQuery = baseQuery && baseQuery !== '*' ? baseQuery : '*';

	const { startTs, endTs } = resolveTimestamps(data);

	const query = index
		.query(combinedQuery)
		.limit(0)
		.agg(data.field, AggregationBuilder.terms(data.field, { size: 50 }));

	query.timeRange(startTs, endTs);

	try {
		const result = await index.search(query);

		const bucketAgg = result.aggregations?.[data.field] as
			| { buckets?: { key: string }[] }
			| undefined;
		const searchLower = data.searchTerm.toLowerCase();
		const values = (bucketAgg?.buckets?.map((b) => formatFieldValue(b.key)) ?? []).filter((v) =>
			v.toLowerCase().includes(searchLower)
		);

		return { values, unsupported: false };
	} catch (e) {
		const msg = e instanceof Error ? e.message : '';
		if (msg.includes('is not configured as a fast field')) {
			return { values: [], unsupported: true };
		}
		throw e;
	}
});

export const pollLiveLogs = command(pollLiveLogsSchema, async (data) => {
	requireUser();

	const fields = await resolveFieldConfig(data.indexName);
	const client = getQuickwitClient();
	const index = client.index(data.indexName);

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.sortBy(`+${fields.timestampField}`)
		.timeRange(data.startTimestamp, data.endTimestamp);

	const result = await index.search(query);

	return { hits: result.hits };
});

export const searchLogHistogram = command(searchLogHistogramSchema, async (data) => {
	requireUser();

	const fields = await resolveFieldConfig(data.indexName);
	const client = getQuickwitClient();
	const index = client.index(data.indexName);

	const { startTs, endTs } = resolveTimestamps(data);

	const windowSeconds = endTs - startTs;
	const interval = computeHistogramInterval(windowSeconds);

	const query = index
		.query(data.query || '*')
		.limit(0)
		.agg(
			'histogram',
			AggregationBuilder.dateHistogram(fields.timestampField, interval, {
				aggs: {
					levels: AggregationBuilder.terms(fields.levelField, { size: 20 })
				}
			})
		);

	query.timeRange(startTs, endTs);

	const result = await index.search(query);

	const histAgg = result.aggregations?.histogram as
		| {
				buckets?: {
					key: number;
					doc_count: number;
					levels?: { buckets?: { key: string; doc_count: number }[] };
				}[];
		  }
		| undefined;

	// Build a map from normalized timestamp → levels
	const bucketMap = new Map<number, Record<string, number>>();
	for (const b of histAgg?.buckets ?? []) {
		const levels: Record<string, number> = {};
		if (b.levels?.buckets) {
			for (const lb of b.levels.buckets) {
				levels[String(lb.key)] = lb.doc_count;
			}
		}
		// Quickwit date_histogram returns ms for datetime fields, seconds for unix timestamps.
		// Anything above 1e12 (~2001 as ms, ~33700 AD as seconds) is treated as milliseconds.
		const ts = b.key > 1e12 ? Math.floor(b.key / 1000) : b.key;
		bucketMap.set(ts, levels);
	}

	// Pad with empty buckets to cover the full time window
	const intervalSec = computeHistogramIntervalSeconds(windowSeconds);
	let buckets: { timestamp: number; levels: Record<string, number> }[];

	buckets = padHistogramBuckets(bucketMap, startTs, endTs, intervalSec);

	return { buckets };
});
