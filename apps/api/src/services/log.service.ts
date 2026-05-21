import type { AggregationBucket, BucketAggregationResult, QuickwitClient } from 'quickwit-js';
import { AggregationBuilder, NotFoundError, ValidationError } from 'quickwit-js';

import type { IndexConfig } from './index.service.js';
import { badRequest, notFound } from '../utils/http-error.js';
import type { FieldValuesResponse, HistogramResponse, LogSearchResponse } from '../types.js';

function translateQuickwitError(err: unknown): never {
	if (err instanceof Error) {
		if (err instanceof ValidationError) throw badRequest(err.message);
		if (err instanceof NotFoundError) throw notFound('Index not found');
	}
	throw err;
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
	const { query = '*', startTs, endTs, limit = 20 } = params;
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
		values: (agg?.buckets ?? []).map((b: AggregationBucket) => ({
			value: String(b.key),
			count: b.doc_count
		}))
	};
}
