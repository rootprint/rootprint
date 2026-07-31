import * as v from 'valibot';

import { IndexIdParams } from '../utils/params.js';
import { tsParam } from '../utils/valibot.js';

// Rejects the all-zeros id: OTLP writes it on logs that carry no trace context.
const TRACE_ID_RE = /^(?!0{32}$)[0-9a-f]{32}$/;

export function isTraceId(value: unknown): value is string {
	return typeof value === 'string' && TRACE_ID_RE.test(value);
}

export const TraceParams = v.object({
	...IndexIdParams.entries,
	traceId: v.pipe(
		v.string(),
		v.regex(
			TRACE_ID_RE,
			'Expected a 32-character lowercase hexadecimal trace id that is not all zeros'
		)
	)
});

export const TraceHistogramQuery = v.pipe(
	v.object({
		startTs: v.pipe(
			tsParam,
			v.metadata({ description: 'Window start as a Unix timestamp in seconds, inclusive.' })
		),
		endTs: v.pipe(
			tsParam,
			v.metadata({ description: 'Window end as a Unix timestamp in seconds, exclusive.' })
		)
	}),
	v.check(({ startTs, endTs }) => startTs < endTs, 'startTs must be earlier than endTs')
);
