import * as v from 'valibot';

import { SortDirectionSchema } from './filters.js';
import { intParam, tsParam } from '../utils/valibot.js';

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

const WindowEntries = {
	startTs: v.pipe(
		tsParam,
		v.metadata({ description: 'Window start as a Unix timestamp in seconds, inclusive.' })
	),
	endTs: v.pipe(
		tsParam,
		v.metadata({ description: 'Window end as a Unix timestamp in seconds, exclusive.' })
	)
};

const SpanFilterEntries = {
	service: v.optional(v.pipe(v.string(), v.nonEmpty(), v.maxLength(255))),
	q: v.optional(
		v.pipe(
			v.string(),
			v.metadata({
				description:
					'Raw Quickwit query text; empty matches every span. Root spans only is `is_root:true`.'
			})
		),
		''
	)
};

const ORDERED_WINDOW = 'startTs must be earlier than endTs';

export const TraceHistogramQuery = v.pipe(
	v.object({ ...WindowEntries, ...SpanFilterEntries }),
	v.check(({ startTs, endTs }) => startTs < endTs, ORDERED_WINDOW)
);

export const TraceSearchQuery = v.pipe(
	v.object({
		...WindowEntries,
		...SpanFilterEntries,
		limit: v.optional(intParam({ min: 1, max: 200, label: 'limit' }), '20'),
		offset: v.optional(
			v.pipe(
				intParam({ min: 0, max: 10_000, label: 'offset' }),
				v.metadata({
					description:
						'Documents to skip, before duplicate spans are collapsed. The ceiling matches the deep-paging limit the log explorer accepts; past it, narrow the window instead.'
				})
			),
			'0'
		),
		sortOrder: v.optional(SortDirectionSchema, 'desc')
	}),
	v.check(({ startTs, endTs }) => startTs < endTs, ORDERED_WINDOW)
);

export const TraceRosterQuery = v.pipe(
	v.object(WindowEntries),
	v.check(({ startTs, endTs }) => startTs < endTs, ORDERED_WINDOW)
);
