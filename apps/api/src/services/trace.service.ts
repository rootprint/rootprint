import type { JaegerKeyValue, QuickwitClient } from 'quickwit-js';

import type { TraceResponse } from '../types.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

const kv = (list: JaegerKeyValue[]): Record<string, string> =>
	Object.fromEntries(list.map((t) => [t.key, String(t.value)]));

// Upgrade: Quickwit's `max_fetch_spans`, or paging back through a raw search.
export async function getTrace(
	qw: QuickwitClient,
	traceIndexId: string,
	traceId: string
): Promise<TraceResponse> {
	const trace = await qw.traces(traceIndexId).getTrace(traceId).catch(translateQuickwitError);
	if (!trace || trace.spans.length === 0) return { spans: [], traceStartMicros: 0, resources: {} };

	// reduce, not Math.min(...spans): the span count is unbounded and a spread would overflow.
	const traceStart = trace.spans.reduce((min, s) => Math.min(min, s.startTime), Infinity);

	return {
		traceStartMicros: traceStart,
		resources: Object.fromEntries(
			Object.entries(trace.processes).map(([id, process]) => [id, kv(process.tags)])
		),
		spans: trace.spans.map((s) => ({
			spanId: s.spanID,
			// Links are FOLLOWS_FROM references; only CHILD_OF is a parent edge.
			parentSpanId: s.references.find((r) => r.refType === 'CHILD_OF')?.spanID ?? null,
			name: s.operationName || '(unnamed)',
			serviceName: trace.processes[s.processID ?? '']?.serviceName ?? 'unknown',
			startOffsetMicros: s.startTime - traceStart,
			durationMicros: s.duration,
			// json!(v_bool) (quickwit-serve/src/jaeger_api/model.rs). OK spans carry no error tag.
			isError: s.tags.some((t) => t.key === 'error' && t.value === true),
			attributes: kv(s.tags),
			resourceId: s.processID,
			events: s.logs.map((l) => {
				const { event, ...fields } = kv(l.fields);
				return { name: event || 'event', timeOffsetMicros: l.timestamp - traceStart, fields };
			})
		}))
	};
}
