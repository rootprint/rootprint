import { error } from '@sveltejs/kit';
import type { BucketAggregationResult } from 'quickwit-js';
import { AggregationBuilder, ValidationError } from 'quickwit-js';

import { QUICKWIT_AGG_MAX } from '$lib/constants/ingest';
import type {
	SearchFieldValuesInput,
	SearchLogHistogramInput,
	SearchLogsInput
} from '$lib/schemas/logs';
import { quickwitClient } from '$lib/server/quickwit';
import { getFieldConfig } from '$lib/server/services/index.service';
import type { QuickFilterBucket } from '$lib/types';
import { formatFieldValue } from '$lib/utils/field-resolver';
import { computeHistogramIntervalSeconds, padHistogramBuckets } from '$lib/utils/histogram';
import { normalizeToMs, resolveTimeRange } from '$lib/utils/time';

function resolveTimestamps(data: {
	startTimestamp?: number;
	endTimestamp?: number;
	timeRange?: string;
}): { startTs: number; endTs: number } {
	if (data.startTimestamp !== undefined && data.endTimestamp !== undefined) {
		return { startTs: data.startTimestamp, endTs: data.endTimestamp };
	}

	if (data.startTimestamp !== undefined || data.endTimestamp !== undefined) {
		error(400, 'Both startTimestamp and endTimestamp must be provided together');
	}

	const preset = data.timeRange ?? '15m';
	const resolved = resolveTimeRange({ type: 'relative', preset });
	if (resolved.startTs === undefined || resolved.endTs === undefined) {
		error(400, `Unknown time range preset: ${preset}`);
	}
	return { startTs: resolved.startTs, endTs: resolved.endTs };
}

function isFastFieldSupported(
	field: string,
	fastFieldNames: string[],
	fastJsonFields: string[]
): boolean {
	return (
		fastFieldNames.includes(field) || fastJsonFields.some((j) => field.startsWith(`${j}.`))
	);
}

function rethrowValidationError(e: unknown): never {
	if (e instanceof ValidationError) {
		error(400, e.message);
	}
	throw e;
}

function toQuickFilterBuckets(
	buckets: BucketAggregationResult['buckets'] | undefined
): QuickFilterBucket[] {
	return (buckets ?? [])
		.map((bucket) => ({
			value: formatFieldValue(bucket.key),
			count: bucket.doc_count
		}))
		.filter((entry) => entry.value !== '');
}

export async function searchLogs(data: SearchLogsInput) {
	const config = await getFieldConfig(data.indexId);
	const index = quickwitClient.index(data.indexId);

	const { startTs, endTs } = resolveTimestamps(data);

	const filterFields = data.quickFilterFields ?? [];

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.offset(data.offset)
		.sortBy(config.timestampField, data.sortDirection ?? 'desc');

	query.timeRange(startTs, endTs);

	for (const field of filterFields) {
		query.agg(field, AggregationBuilder.terms(field, { size: QUICKWIT_AGG_MAX }));
	}

	const result = await index.search(query).catch(rethrowValidationError);

	const aggregations: Record<string, QuickFilterBucket[]> = {};
	for (const [field, agg] of Object.entries(result.aggregations ?? {})) {
		aggregations[field] = toQuickFilterBuckets((agg as BucketAggregationResult).buckets);
	}

	return {
		hits: result.hits,
		numHits: result.num_hits,
		startTimestamp: startTs,
		endTimestamp: endTs,
		aggregations
	};
}

export async function searchFieldValues(data: SearchFieldValuesInput) {
	const config = await getFieldConfig(data.indexId);
	if (!isFastFieldSupported(data.field, config.fastFieldNames, config.fastJsonFields)) {
		return { values: [], totalHits: 0, unsupported: true };
	}

	const index = quickwitClient.index(data.indexId);

	const combinedQuery = data.query?.trim() || '*';

	const { startTs, endTs } = resolveTimestamps(data);

	const query = index
		.query(combinedQuery)
		.limit(0)
		.agg(data.field, AggregationBuilder.terms(data.field, { size: QUICKWIT_AGG_MAX }));

	query.timeRange(startTs, endTs);

	const result = await index.search(query).catch(rethrowValidationError);

	const bucketAgg = result.aggregations?.[data.field] as BucketAggregationResult | undefined;
	const searchLower = data.searchTerm.toLowerCase();
	const values = toQuickFilterBuckets(bucketAgg?.buckets).filter((entry) =>
		entry.value.toLowerCase().includes(searchLower)
	);

	return { values, totalHits: result.num_hits, unsupported: false };
}

export async function searchLogHistogram(data: SearchLogHistogramInput) {
	const config = await getFieldConfig(data.indexId);
	const index = quickwitClient.index(data.indexId);

	const { startTs, endTs } = resolveTimestamps(data);

	const windowSeconds = endTs - startTs;
	const intervalSec = computeHistogramIntervalSeconds(windowSeconds);

	const query = index
		.query(data.query || '*')
		.limit(0)
		.agg(
			'histogram',
			AggregationBuilder.dateHistogram(config.timestampField, `${intervalSec}s`, {
				aggs: {
					levels: AggregationBuilder.terms(config.levelField, { size: 20 })
				}
			})
		);

	query.timeRange(startTs, endTs);

	const result = await index.search(query).catch(rethrowValidationError);

	const histAgg = result.aggregations?.histogram as BucketAggregationResult | undefined;

	const bucketMap = new Map<number, Record<string, number>>();
	for (const b of histAgg?.buckets ?? []) {
		const levelsAgg = (b as { levels?: BucketAggregationResult }).levels;
		const levels: Record<string, number> = {};
		for (const lb of levelsAgg?.buckets ?? []) {
			levels[String(lb.key)] = lb.doc_count;
		}
		const ts = Math.floor(normalizeToMs(Number(b.key)) / 1000);
		bucketMap.set(ts, levels);
	}

	const buckets = padHistogramBuckets(bucketMap, startTs, endTs, intervalSec);

	return { buckets };
}
