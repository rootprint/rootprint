import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

const TraceAttributesSchema = v.record(v.string(), v.string());

export const SpanEventSchema = named(
	'SpanEvent',
	v.object({
		name: v.string(),
		timeOffsetMicros: v.number(),
		fields: TraceAttributesSchema
	})
);

export const TraceSpanSchema = named(
	'TraceSpan',
	v.object({
		spanId: v.string(),
		parentSpanId: v.nullable(v.string()),
		name: v.string(),
		serviceName: v.string(),
		startOffsetMicros: v.number(),
		durationMicros: v.number(),
		isError: v.boolean(),
		attributes: TraceAttributesSchema,
		resourceId: v.string(),
		events: v.array(SpanEventSchema)
	})
);

export const TraceResponse = named(
	'TraceResponse',
	v.object({
		spans: v.array(TraceSpanSchema),
		traceStartMicros: v.number(),
		resources: v.record(v.string(), TraceAttributesSchema),
		truncated: v.pipe(
			v.boolean(),
			v.metadata({
				description:
					'The trace has more span documents than one request returns, or contained documents missing a required field, so some spans are absent. The displayed trace is incomplete.'
			})
		)
	})
);

export const SpanListRowSchema = named(
	'SpanListRow',
	v.object({
		traceId: v.pipe(v.string(), v.metadata({ description: 'The trace this span belongs to.' })),
		spanId: v.pipe(
			v.string(),
			v.metadata({
				description:
					'Unique only within traceId, and only per logical span: OTLP retries can write more than one document for the same traceId/spanId pair.'
			})
		),
		operation: v.pipe(v.string(), v.metadata({ description: "The span's operation name." })),
		service: v.pipe(v.string(), v.metadata({ description: "The span's service." })),
		startMicros: v.pipe(
			v.number(),
			v.metadata({ description: 'Span start, as Unix epoch microseconds.' })
		),
		durationMicros: v.pipe(
			v.number(),
			v.metadata({
				description:
					'Derived from span_end_timestamp_nanos minus span_start_timestamp_nanos, because span_duration_millis floors sub-millisecond spans to 0.'
			})
		),
		isError: v.pipe(
			v.boolean(),
			v.metadata({
				description:
					"Whether this span's own span_status reports an error. An ancestor or descendant failing does not set it, nor does a failure recorded only in span_attributes."
			})
		),
		isRoot: v.pipe(
			v.boolean(),
			v.metadata({
				description:
					'Whether this span starts its trace. Derived from an empty parent_span_id: `is_root` is queryable in the otel-traces schema but never returned in hits.'
			})
		)
	})
);

export const TraceSearchResponse = named(
	'TraceSearchResponse',
	v.object({
		spans: v.pipe(
			v.array(SpanListRowSchema),
			v.metadata({
				description:
					'One row per matching span document, ordered by span start time. Page with limit/offset; duplicate documents from OTLP retries are collapsed by the client, not here.'
			})
		)
	})
);

export const TraceServicesResponse = named(
	'TraceServicesResponse',
	v.object({ services: v.array(v.string()) })
);

export const TraceDurationBandSchema = named(
	'TraceDurationBand',
	v.object({
		key: v.pipe(
			v.string(),
			v.metadata({ description: 'Stable identifier for the band, e.g. "64-256".' })
		),
		fromMs: v.pipe(
			v.nullable(v.number()),
			v.metadata({
				description: 'Inclusive lower edge in milliseconds; null on the open-ended bottom band.'
			})
		),
		toMs: v.pipe(
			v.nullable(v.number()),
			v.metadata({
				description: 'Exclusive upper edge in milliseconds; null on the open-ended top band.'
			})
		)
	})
);

export const TraceHistogramColumnSchema = named(
	'TraceHistogramColumn',
	v.object({
		timestamp: v.pipe(
			v.number(),
			v.metadata({
				description: 'Unix timestamp in seconds at the start of the column; it spans intervalSec.'
			})
		),
		docCount: v.pipe(
			v.number(),
			v.metadata({
				description:
					'Matching span documents in this column, across all bands. Aggregations cannot collapse OTLP retry duplicates, so this counts documents, not logical spans.'
			})
		),
		counts: v.pipe(
			v.array(v.number()),
			v.metadata({
				description:
					'Span documents per duration band. Aligned positionally with bands: counts[i] belongs to bands[i].'
			})
		)
	})
);

export const TraceHistogramResponse = named(
	'TraceHistogramResponse',
	v.object({
		intervalSec: v.pipe(
			v.number(),
			v.metadata({
				description:
					'Column width in seconds, chosen by the server from the requested window; the client does not set it.'
			})
		),
		bands: v.pipe(
			v.array(TraceDurationBandSchema),
			v.metadata({ description: 'Duration bands, ascending, from the open-ended bottom band up.' })
		),
		columns: v.pipe(
			v.array(TraceHistogramColumnSchema),
			v.metadata({
				description:
					'One entry per interval across the window, ascending and gap-free; empty intervals are present with zero counts.'
			})
		)
	})
);
