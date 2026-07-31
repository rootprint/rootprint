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
		resourceId: v.nullable(v.string()),
		events: v.array(SpanEventSchema)
	})
);

export const TraceResponse = named(
	'TraceResponse',
	v.object({
		spans: v.array(TraceSpanSchema),
		traceStartMicros: v.number(),
		resources: v.record(v.string(), TraceAttributesSchema)
	})
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
			v.metadata({ description: 'Traces in this column, across all bands.' })
		),
		counts: v.pipe(
			v.array(v.number()),
			v.metadata({
				description:
					'Traces per duration band. Aligned positionally with bands: counts[i] belongs to bands[i].'
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
