import type { Filter, TimeRange } from '$lib/types';
import { serialize } from '$lib/utils/query-params';

const PAD_SECONDS = 2;

/** Not configurable, unlike `trace_id_field` — the otel-logs schema names it. */
export const SPAN_ID_FIELD = 'span_id';

export interface TraceLogsTarget {
	indexId: string;
	traceIdField: string;
	traceId: string;
	traceStartMicros: number;
	startOffsetMicros: number;
	durationMicros: number;
	spanId?: string;
}

export function traceLogsWindow(target: TraceLogsTarget): TimeRange {
	const startMicros = target.traceStartMicros + target.startOffsetMicros;
	return {
		type: 'absolute',
		start: Math.floor(startMicros / 1e6) - PAD_SECONDS,
		end: Math.ceil((startMicros + target.durationMicros) / 1e6) + PAD_SECONDS
	};
}

export function traceLogsFilters(target: TraceLogsTarget): Filter[] {
	const filters: Filter[] = [{ field: target.traceIdField, value: target.traceId, exclude: false }];
	if (target.spanId) filters.push({ field: SPAN_ID_FIELD, value: target.spanId, exclude: false });
	return filters;
}

export function traceLogsHref(target: TraceLogsTarget): string {
	const params = serialize({
		index: target.indexId,
		query: '',
		sortDirection: 'desc',
		timeRange: traceLogsWindow(target),
		filters: traceLogsFilters(target)
	});
	return `/?${params.toString()}`;
}
