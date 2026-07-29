import type { QuickwitClient } from 'quickwit-js';

import type { TraceResponse } from '../types.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

// ponytail: Jaeger's get_trace takes no limit, so a pathological trace transfers whole.
// Upgrade: Quickwit's `max_fetch_spans`, or paging back through a raw search.
export async function getTrace(
	qw: QuickwitClient,
	traceIndexId: string,
	traceId: string
): Promise<TraceResponse> {
	const trace = await qw.traces(traceIndexId).getTrace(traceId).catch(translateQuickwitError);
	if (!trace || trace.spans.length === 0) return { spans: [] };

	// reduce, not Math.min(...spans): the span count is unbounded and a spread would overflow.
	const traceStart = trace.spans.reduce((min, s) => Math.min(min, s.startTime), Infinity);

	return {
		spans: trace.spans.map((s) => ({
			spanId: s.spanID,
			// Links are FOLLOWS_FROM references; only CHILD_OF is a parent edge.
			parentSpanId: s.references.find((r) => r.refType === 'CHILD_OF')?.spanID ?? null,
			name: s.operationName || '(unnamed)',
			serviceName: trace.processes[s.processID ?? '']?.serviceName ?? 'unknown',
			startOffsetMicros: s.startTime - traceStart,
			durationMicros: s.duration,
			isError: s.tags.some((t) => t.key === 'error' && t.value === true)
		}))
	};
}
