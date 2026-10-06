import * as v from 'valibot';

import { EXPLORE_SORTS, EXPLORE_STATUSES, MAX_EXPLORE_LIMIT } from '../constants.js';
import { SortDirectionSchema } from './filters.js';
import { intervalParam } from './services.js';
import { TraceParams } from './traces.js';

const trimmed = v.transform((s: string) => s.trim());

const time = (fallback: string) =>
	v.optional(
		v.pipe(
			v.string(),
			v.maxLength(64),
			v.description('ISO 8601 (2026-10-06T14:30:00Z) or relative: now, now-15m, now-6h, now-7d')
		),
		fallback
	);

const indexId = v.pipe(
	v.string(),
	v.minLength(1),
	v.maxLength(255),
	v.description('An indexId from list_indexes')
);

const logQuery = v.optional(
	v.pipe(
		v.string(),
		v.minLength(1),
		v.maxLength(2_000),
		v.description('Quickwit query; omit to match everything')
	)
);

export const ListIndexesInput = v.strictObject({});

export const GetIndexFieldsInput = v.strictObject({
	indexId,
	start: time('now-24h'),
	end: time('now')
});

export const SearchLogsInput = v.strictObject({
	indexId,
	query: logQuery,
	start: time('now-1h'),
	end: time('now'),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)), 20),
	sort: v.optional(SortDirectionSchema, 'desc')
});

export const LogHistogramInput = v.strictObject({
	indexId,
	query: logQuery,
	start: time('now-1h'),
	end: time('now'),
	interval: v.optional(
		v.pipe(
			intervalParam,
			v.description('Bucket width such as 1m, 5m or 1h; omit to get about 60 buckets')
		)
	)
});

export const FieldValuesInput = v.strictObject({
	indexId,
	fields: v.pipe(
		v.array(v.pipe(v.string(), v.minLength(1), trimmed)),
		v.minLength(1),
		v.maxLength(10)
	),
	query: logQuery,
	start: time('now-1h'),
	end: time('now'),
	limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 10)
});

export const SearchSpansInput = v.strictObject({
	service: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200), trimmed)),
	operation: v.optional(
		v.pipe(v.string(), v.minLength(1), v.maxLength(500), v.description('Span name'), trimmed)
	),
	status: v.optional(v.picklist(EXPLORE_STATUSES), 'all'),
	minMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	maxMs: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
	root: v.optional(v.pipe(v.boolean(), v.description('Only root spans, one per request'))),
	query: v.optional(
		v.pipe(v.string(), v.maxLength(2_000), v.description('Quickwit query on span fields'), trimmed)
	),
	start: time('now-1h'),
	end: time('now'),
	sort: v.optional(v.picklist(EXPLORE_SORTS), '-start'),
	limit: v.optional(
		v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_EXPLORE_LIMIT)),
		20
	)
});

export const GetTraceInput = v.strictObject(TraceParams.entries);
