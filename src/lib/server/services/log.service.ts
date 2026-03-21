import { db } from '$lib/server/db';
import { qwFieldMapping } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getFieldConfig } from '$lib/server/services/index.service';
import { AggregationBuilder, ValidationError } from 'quickwit-js';
import { error } from '@sveltejs/kit';
import { getQuickwitClient } from '$lib/server/quickwit';
import { resolveTimeRange } from '$lib/utils/time';
import { formatFieldValue } from '$lib/utils/field-resolver';
import {
	computeHistogramInterval,
	computeHistogramIntervalSeconds,
	padHistogramBuckets
} from '$lib/utils/histogram';
import type { SearchLogsInput } from '$lib/schemas/logs';

function resolveTimestamps(data: {
	startTimestamp?: number;
	endTimestamp?: number;
	timeRange?: string;
}): { startTs: number; endTs: number } {
	const hasStart = data.startTimestamp !== undefined;
	const hasEnd = data.endTimestamp !== undefined;

	if (hasStart && hasEnd) {
		return { startTs: data.startTimestamp!, endTs: data.endTimestamp! };
	}

	if (hasStart !== hasEnd) {
		throw new Error('Both startTimestamp and endTimestamp must be provided together');
	}

	const preset = data.timeRange ?? '15m';
	const resolved = resolveTimeRange({ type: 'relative', preset });
	if (resolved.startTs === undefined || resolved.endTs === undefined) {
		throw new Error(`Unknown time range preset: ${preset}`);
	}
	return { startTs: resolved.startTs, endTs: resolved.endTs };
}

async function partitionFastFields(
	internalId: number | null,
	requestedFields: string[],
	fastJsonFields: string[]
): Promise<{ fast: string[]; unsupported: string[] }> {
	if (requestedFields.length === 0) return { fast: [], unsupported: [] };
	if (internalId === null) return { fast: [], unsupported: requestedFields };

	const fastRows = await db
		.select({ name: qwFieldMapping.name })
		.from(qwFieldMapping)
		.where(
			and(
				eq(qwFieldMapping.indexId, internalId),
				eq(qwFieldMapping.fast, true),
				inArray(qwFieldMapping.name, requestedFields)
			)
		);

	const fastSet = new Set(fastRows.map((r) => r.name));

	for (const f of requestedFields) {
		if (!fastSet.has(f) && fastJsonFields.some((j) => f.startsWith(`${j}.`))) {
			fastSet.add(f);
		}
	}

	return {
		fast: requestedFields.filter((f) => fastSet.has(f)),
		unsupported: requestedFields.filter((f) => !fastSet.has(f))
	};
}

function rethrowValidationError(e: unknown): never {
	if (e instanceof ValidationError) {
		error(400, e.message);
	}
	throw e;
}

export async function searchLogs(data: SearchLogsInput & { quickFilterFields?: string[] }) {
	const config = getFieldConfig(data.indexId);
	const client = getQuickwitClient();
	const index = client.index(data.indexId);

	const { startTs, endTs } = resolveTimestamps(data);

	const { fast: filterFields, unsupported: unsupportedFilterFields } = await partitionFastFields(
		config.id,
		data.quickFilterFields ?? [],
		config.fastJsonFields
	);

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.offset(data.offset)
		.sortBy(`+${config.timestampField}`);

	query.timeRange(startTs, endTs);

	for (const field of filterFields) {
		query.agg(field, AggregationBuilder.terms(field, { size: 100 }));
	}

	const result = await index.search(query).catch(rethrowValidationError);

	const aggregations: Record<string, string[]> = {};
	if (result.aggregations) {
		for (const [field, agg] of Object.entries(result.aggregations)) {
			const bucketAgg = agg as { buckets?: { key: string }[] };
			if (bucketAgg.buckets) {
				aggregations[field] = bucketAgg.buckets
					.map((b) => formatFieldValue(b.key))
					.filter((v) => v !== '');
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
}

export async function searchFieldValues(data: {
	indexId: string;
	field: string;
	searchTerm: string;
	query?: string;
	startTimestamp?: number;
	endTimestamp?: number;
	timeRange?: string;
}) {
	const config = getFieldConfig(data.indexId);
	const { unsupported } = await partitionFastFields(config.id, [data.field], config.fastJsonFields);
	if (unsupported.length > 0) {
		return { values: [], unsupported: true };
	}

	const client = getQuickwitClient();
	const index = client.index(data.indexId);

	const baseQuery = data.query?.trim();
	const combinedQuery = baseQuery && baseQuery !== '*' ? baseQuery : '*';

	const { startTs, endTs } = resolveTimestamps(data);

	const query = index
		.query(combinedQuery)
		.limit(0)
		.agg(data.field, AggregationBuilder.terms(data.field, { size: 100 }));

	query.timeRange(startTs, endTs);

	const result = await index.search(query).catch(rethrowValidationError);

	const bucketAgg = result.aggregations?.[data.field] as
		| { buckets?: { key: string }[] }
		| undefined;
	const searchLower = data.searchTerm.toLowerCase();
	const values = (bucketAgg?.buckets?.map((b) => formatFieldValue(b.key)) ?? []).filter(
		(v) => v !== '' && v.toLowerCase().includes(searchLower)
	);

	return { values, unsupported: false };
}

export async function pollLiveLogs(data: {
	indexId: string;
	query: string;
	limit: number;
	startTimestamp: number;
	endTimestamp: number;
}) {
	const config = getFieldConfig(data.indexId);
	const client = getQuickwitClient();
	const index = client.index(data.indexId);

	const query = index
		.query(data.query || '*')
		.limit(data.limit)
		.sortBy(`+${config.timestampField}`)
		.timeRange(data.startTimestamp, data.endTimestamp);

	const result = await index.search(query).catch(rethrowValidationError);

	return { hits: result.hits };
}

export async function searchLogHistogram(data: {
	indexId: string;
	query: string;
	startTimestamp?: number;
	endTimestamp?: number;
	timeRange?: string;
}) {
	const config = getFieldConfig(data.indexId);
	const client = getQuickwitClient();
	const index = client.index(data.indexId);

	const { startTs, endTs } = resolveTimestamps(data);

	const windowSeconds = endTs - startTs;
	const interval = computeHistogramInterval(windowSeconds);

	const query = index
		.query(data.query || '*')
		.limit(0)
		.agg(
			'histogram',
			AggregationBuilder.dateHistogram(config.timestampField, interval, {
				aggs: {
					levels: AggregationBuilder.terms(config.levelField, { size: 20 })
				}
			})
		);

	query.timeRange(startTs, endTs);

	const result = await index.search(query).catch(rethrowValidationError);

	const histAgg = result.aggregations?.histogram as
		| {
				buckets?: {
					key: number;
					doc_count: number;
					levels?: { buckets?: { key: string; doc_count: number }[] };
				}[];
		  }
		| undefined;

	const bucketMap = new Map<number, Record<string, number>>();
	for (const b of histAgg?.buckets ?? []) {
		const levels: Record<string, number> = {};
		if (b.levels?.buckets) {
			for (const lb of b.levels.buckets) {
				levels[String(lb.key)] = lb.doc_count;
			}
		}
		const ts = b.key > 1e12 ? Math.floor(b.key / 1000) : b.key;
		bucketMap.set(ts, levels);
	}

	const intervalSec = computeHistogramIntervalSeconds(windowSeconds);
	const buckets = padHistogramBuckets(bucketMap, startTs, endTs, intervalSec);

	return { buckets };
}
