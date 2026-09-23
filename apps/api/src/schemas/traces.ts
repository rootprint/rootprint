import * as v from 'valibot';

import {
	EXPLORE_PAGE_SIZE,
	EXPLORE_SORTS,
	EXPLORE_STATUSES,
	MAX_EXPLORE_LIMIT,
	MAX_EXPLORE_OFFSET
} from '../constants.js';
import { EPOCH_SECONDS, intParam } from '../utils/valibot.js';
import { intervalParam, intervalSeconds, MAX_BUCKETS, MAX_RANGE_SECONDS } from './monitoring.js';

// Rejects the all-zeros id: OTLP writes it on logs that carry no trace context.
const TRACE_ID_RE = /^(?!0{32}$)[0-9a-f]{32}$/;

export function isTraceId(value: unknown): value is string {
	return typeof value === 'string' && TRACE_ID_RE.test(value);
}

export const TraceParams = v.object({
	traceId: v.pipe(
		v.string(),
		v.regex(
			TRACE_ID_RE,
			'Expected a 32-character lowercase hexadecimal trace id that is not all zeros'
		)
	)
});

const MAX_QUERY_CHARS = 2_000;

/** `q` is spliced in as `(${q})`, so a stray `)` would close that group and escape the other filters. */
function hasBalancedParens(query: string): boolean {
	let depth = 0;
	let quoted = false;
	for (let i = 0; i < query.length; i++) {
		const ch = query[i];
		if (ch === '\\') i++;
		else if (ch === '"') quoted = !quoted;
		else if (!quoted && ch === '(') depth++;
		else if (!quoted && ch === ')' && --depth < 0) return false;
	}
	return depth === 0 && !quoted;
}

const exploreFilterEntries = {
	startTs: v.pipe(intParam({ min: 0, label: 'startTs' }), v.description(EPOCH_SECONDS)),
	endTs: v.pipe(intParam({ min: 0, label: 'endTs' }), v.description(EPOCH_SECONDS)),
	service: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
	operation: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(500))),
	minMs: v.optional(intParam({ min: 0, label: 'minMs' })),
	maxMs: v.optional(intParam({ min: 1, label: 'maxMs' })),
	status: v.optional(v.picklist(EXPLORE_STATUSES), 'all'),
	q: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.maxLength(MAX_QUERY_CHARS),
			v.check(hasBalancedParens, 'Query has unbalanced parentheses or quotes')
		)
	)
};

export const ExploreSpansQuery = v.pipe(
	v.object({
		...exploreFilterEntries,
		sort: v.optional(v.picklist(EXPLORE_SORTS), '-start'),
		limit: v.optional(
			intParam({ min: 1, max: MAX_EXPLORE_LIMIT, label: 'limit' }),
			String(EXPLORE_PAGE_SIZE)
		),
		offset: v.optional(intParam({ min: 0, max: MAX_EXPLORE_OFFSET, label: 'offset' }), '0')
	}),
	v.check((input) => input.startTs < input.endTs, 'startTs must be before endTs'),
	v.check(
		(input) => input.endTs - input.startTs <= MAX_RANGE_SECONDS,
		'Trace range cannot exceed 30 days'
	),
	v.check(
		(input) => input.minMs === undefined || input.maxMs === undefined || input.minMs < input.maxMs,
		'minMs must be below maxMs'
	)
);
export type ExploreSpansInput = v.InferOutput<typeof ExploreSpansQuery>;
export type ExploreFilters = Omit<ExploreSpansInput, 'sort' | 'limit' | 'offset'>;

export const ExploreOverviewQuery = v.pipe(
	v.object({ ...exploreFilterEntries, interval: intervalParam }),
	v.check((input) => input.startTs < input.endTs, 'startTs must be before endTs'),
	v.check(
		(input) => input.endTs - input.startTs <= MAX_RANGE_SECONDS,
		'Trace range cannot exceed 30 days'
	),
	v.check(
		(input) => input.minMs === undefined || input.maxMs === undefined || input.minMs < input.maxMs,
		'minMs must be below maxMs'
	),
	v.check(
		(input) => (input.endTs - input.startTs) / intervalSeconds(input.interval) <= MAX_BUCKETS,
		'interval produces too many buckets'
	)
);
export type ExploreOverviewInput = v.InferOutput<typeof ExploreOverviewQuery>;
