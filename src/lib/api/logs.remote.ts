import { command } from '$app/server';
import { db } from '$lib/server/db';
import { indexConfig } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	searchLogsSchema,
	searchFieldValuesSchema,
	searchLogHistogramSchema
} from '$lib/schemas/logs';
import { computeHistogramInterval, computeHistogramIntervalSeconds, padHistogramBuckets } from '$lib/utils/histogram';
import { AggregationBuilder } from 'quickwit-js';
import { requireUser } from '$lib/middleware/auth';
import { getQuickwitClient } from '$lib/server/quickwit';
import { TIME_PRESETS } from '$lib/types';

function resolveTimestamps(data: {
	startTimestamp?: number;
	endTimestamp?: number;
	timeRange: string;
}): { startTs: number | undefined; endTs: number | undefined } {
	if (data.startTimestamp !== undefined && data.endTimestamp !== undefined) {
		return { startTs: data.startTimestamp, endTs: data.endTimestamp };
	}
	const preset = TIME_PRESETS.find((p) => p.code === data.timeRange);
	if (preset) {
		const endTs = Math.floor(Date.now() / 1000);
		return { startTs: endTs - preset.seconds, endTs };
	}
	return { startTs: undefined, endTs: undefined };
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

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.offset(data.offset)
		.sortBy(`+${fields.timestampField}`);

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

	if (data.quickFilterFields?.length) {
		for (const field of data.quickFilterFields) {
			query.agg(field, AggregationBuilder.terms(field, { size: 50 }));
		}
	}

	const result = await index.search(query);

	const aggregations: Record<string, string[]> = {};
	if (result.aggregations) {
		for (const [field, agg] of Object.entries(result.aggregations)) {
			const bucketAgg = agg as { buckets?: { key: string }[] };
			if (bucketAgg.buckets) {
				aggregations[field] = bucketAgg.buckets.map((b) => String(b.key));
			}
		}
	}

	return {
		hits: result.hits,
		numHits: result.num_hits,
		startTimestamp: startTs,
		endTimestamp: endTs,
		aggregations
	};
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

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

	const result = await index.search(query);

	const bucketAgg = result.aggregations?.[data.field] as
		| { buckets?: { key: string }[] }
		| undefined;
	const searchLower = data.searchTerm.toLowerCase();
	const values = (bucketAgg?.buckets?.map((b) => String(b.key)) ?? []).filter((v) =>
		v.toLowerCase().includes(searchLower)
	);

	return { values };
});

export const searchLogHistogram = command(searchLogHistogramSchema, async (data) => {
	requireUser();

	const fields = await resolveFieldConfig(data.indexName);
	const client = getQuickwitClient();
	const index = client.index(data.indexName);

	const { startTs, endTs } = resolveTimestamps(data);

	const windowSeconds =
		endTs !== undefined && startTs !== undefined ? endTs - startTs : 15 * 60;
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

	if (startTs !== undefined && endTs !== undefined) {
		query.timeRange(startTs, endTs);
	}

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
		// Quickwit date_histogram returns keys in milliseconds when the field
		// uses a datetime format, but in seconds for unix timestamps.
		// Normalise to seconds: anything above 1e12 (~2001 in ms) is treated as ms.
		const ts = b.key > 1e12 ? Math.floor(b.key / 1000) : b.key;
		bucketMap.set(ts, levels);
	}

	// Pad with empty buckets to cover the full time window
	const intervalSec = computeHistogramIntervalSeconds(windowSeconds);
	let buckets: { timestamp: number; levels: Record<string, number> }[];

	if (startTs !== undefined && endTs !== undefined) {
		buckets = padHistogramBuckets(bucketMap, startTs, endTs, intervalSec);
	} else {
		// No time bounds — just return what Quickwit gave us
		buckets = [...bucketMap].map(([ts, levels]) => ({ timestamp: ts, levels }));
	}

	return { buckets };
});
