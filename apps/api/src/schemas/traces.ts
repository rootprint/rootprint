import * as v from 'valibot';

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
