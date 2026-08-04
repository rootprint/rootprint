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
