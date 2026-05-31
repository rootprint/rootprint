import type { AggregationBucket, BucketAggregationResult, QuickwitClient } from 'quickwit-js';
import { AggregationBuilder } from 'quickwit-js';

import type { IndexConfig } from './index.service.js';
import type { SearchQueryInput } from '../schemas/search.js';
import { FIELD_VALUES_DEFAULT } from '../constants/search.js';
import { composeQuery } from '../lib/query/compose-query.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';
import type {
	FieldValueEntry,
	FieldValuesBulkResponse,
	FieldValuesResponse,
	Filter,
	HistogramResponse,
	LogSearchResponse
} from '../types.js';

/** Maps terms-aggregation buckets to field-value entries, dropping empty-string keys. */
function bucketsToEntries(buckets: AggregationBucket[] | undefined): FieldValueEntry[] {
	return (buckets ?? []).flatMap((b) => {
		const value = String(b.key);
		return value === '' ? [] : [{ value, count: b.doc_count }];
	});
}

type SearchParams = {
	query?: string;
	limit?: number;
	offset?: number;
	startTs?: number;
	endTs?: number;
	sortOrder?: 'asc' | 'desc';
	countAll?: boolean;
};

/** Maps a validated SearchQuery into searchLogs params (the `q` field is renamed to `query`). */
export function toSearchParams(q: SearchQueryInput): SearchParams {
	return {
		query: q.q,
		limit: q.limit,
		offset: q.offset,
		startTs: q.startTs,
		endTs: q.endTs,
		sortOrder: q.sortOrder,
		countAll: q.countAll
	};
}

type HistogramParams = {
	query?: string;
	startTs?: number;
	endTs?: number;
	interval: string;
};

type FieldValuesParams = {
	query?: string;
	startTs?: number;
	endTs?: number;
	limit?: number;
};

export async function searchLogs(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	params: SearchParams
): Promise<LogSearchResponse> {
	const {
		query = '*',
		limit = 50,
		offset = 0,
		startTs,
		endTs,
		sortOrder = 'desc',
		countAll
	} = params;
	const idx = qw.index(indexConfig.indexId);
	const builder = idx
		.query(query)
		.limit(limit)
		.offset(offset)
		.sortBy(indexConfig.timestampField, sortOrder);
	if (countAll) builder.countAll();
	if (startTs !== undefined) builder.startTimestamp(startTs);
	if (endTs !== undefined) builder.endTimestamp(endTs);
	const response = await idx.search(builder).catch(translateQuickwitError);
	return {
		hits: response.hits,
		numHits: response.num_hits,
		elapsedTimeMicros: response.elapsed_time_micros
	};
}

export async function histogramLogs(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	params: HistogramParams
): Promise<HistogramResponse> {
	const { query = '*', startTs, endTs, interval } = params;
	const idx = qw.index(indexConfig.indexId);
	const histogramOptions = indexConfig.levelField
		? { aggs: { levels: AggregationBuilder.terms(indexConfig.levelField, { size: 16 }) } }
		: undefined;
	const builder = idx
		.query(query)
		.limit(0)
		.agg(
			'histogram',
			AggregationBuilder.dateHistogram(indexConfig.timestampField, interval, histogramOptions)
		);
	if (startTs !== undefined) builder.startTimestamp(startTs);
	if (endTs !== undefined) builder.endTimestamp(endTs);
	const response = await idx.search(builder).catch(translateQuickwitError);
	const agg = response.aggregations?.['histogram'] as BucketAggregationResult | undefined;
	return {
		buckets: (agg?.buckets ?? []).map((b: AggregationBucket) => {
			const levelsAgg = (b as { levels?: BucketAggregationResult }).levels;
			const levels: Record<string, number> = {};
			for (const lb of levelsAgg?.buckets ?? []) {
				levels[String(lb.key)] = lb.doc_count;
			}
			return {
				key: Number(b.key),
				keyAsString: b.key_as_string ?? String(b.key),
				docCount: b.doc_count,
				levels
			};
		})
	};
}

export async function fieldValues(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	field: string,
	params: FieldValuesParams
): Promise<FieldValuesResponse> {
	const { query = '*', startTs, endTs, limit = FIELD_VALUES_DEFAULT } = params;
	const idx = qw.index(indexConfig.indexId);
	const builder = idx
		.query(query)
		.limit(0)
		.agg('values', AggregationBuilder.terms(field, { size: limit }));
	if (startTs !== undefined) builder.startTimestamp(startTs);
	if (endTs !== undefined) builder.endTimestamp(endTs);
	const response = await idx.search(builder).catch(translateQuickwitError);
	const agg = response.aggregations?.['values'] as BucketAggregationResult | undefined;
	return {
		values: bucketsToEntries(agg?.buckets)
	};
}

type FieldValuesBulkParams = {
	fields: string[];
	query?: string;
	filters?: Filter[];
	startTs?: number;
	endTs?: number;
	limit?: number;
};

type BulkGroup = { fields: string[]; effectiveFilters: Filter[] };

export function groupFieldsForBulk(fields: string[], filters: Filter[]): BulkGroup[] {
	const uniqueFields = [...new Set(fields)];
	const filterFieldSet = new Set(filters.map((f) => f.field));
	const filteredFields = new Set<string>();
	for (const f of uniqueFields) {
		if (filterFieldSet.has(f)) filteredFields.add(f);
	}

	const unfiltered = uniqueFields.filter((f) => !filteredFields.has(f));

	const groups: BulkGroup[] = [];
	if (unfiltered.length > 0) {
		groups.push({ fields: unfiltered, effectiveFilters: filters });
	}
	for (const field of filteredFields) {
		groups.push({
			fields: [field],
			effectiveFilters: filters.filter((f) => f.field !== field)
		});
	}
	return groups;
}

export async function fieldValuesBulk(
	qw: QuickwitClient,
	indexConfig: IndexConfig,
	params: FieldValuesBulkParams
): Promise<FieldValuesBulkResponse> {
	const { fields, query = '', filters = [], startTs, endTs, limit = FIELD_VALUES_DEFAULT } = params;

	if (fields.length === 0) {
		return { values: {} };
	}

	const groups = groupFieldsForBulk(fields, filters);
	const idx = qw.index(indexConfig.indexId);

	const groupResults = await Promise.all(
		groups.map(async (group) => {
			const composed = composeQuery(query, group.effectiveFilters) || '*';
			const builder = idx.query(composed).limit(0);
			for (const field of group.fields) {
				builder.agg(field, AggregationBuilder.terms(field, { size: limit }));
			}
			if (startTs !== undefined) builder.startTimestamp(startTs);
			if (endTs !== undefined) builder.endTimestamp(endTs);
			const response = await idx.search(builder).catch(translateQuickwitError);
			return { group, response };
		})
	);

	const values: Record<string, FieldValueEntry[]> = {};
	let elapsedTimeMicros = 0;
	for (const { group, response } of groupResults) {
		elapsedTimeMicros += response.elapsed_time_micros ?? 0;
		for (const field of group.fields) {
			const agg = response.aggregations?.[field] as BucketAggregationResult | undefined;
			values[field] = bucketsToEntries(agg?.buckets);
		}
	}

	return { values, elapsedTimeMicros };
}
