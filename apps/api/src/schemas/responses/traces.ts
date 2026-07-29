import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

export const TraceSpanSchema = named(
	'TraceSpan',
	v.object({
		spanId: v.string(),
		parentSpanId: v.nullable(v.string()),
		name: v.string(),
		serviceName: v.string(),
		startOffsetMicros: v.number(),
		durationMicros: v.number(),
		isError: v.boolean()
	})
);

export const TraceResponse = named('TraceResponse', v.object({ spans: v.array(TraceSpanSchema) }));
