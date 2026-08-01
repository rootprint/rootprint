import type { SortDirection, TimeRange } from '$lib/types';
import { buildQueryUrl } from '$lib/utils/query-params';

export interface TraceParams {
	service: string | null;
	operation: string | null;
	minMs: number | null;
	maxMs: number | null;
	errorsOnly: boolean;
}

function positiveInt(raw: string | null): number | null {
	if (raw === null || raw === '') return null;
	const n = Number(raw);
	return Number.isInteger(n) && n >= 0 ? n : null;
}

export function deserializeTraceParams(params: URLSearchParams): TraceParams {
	return {
		service: params.get('svc') || null,
		operation: params.get('op') || null,
		minMs: positiveInt(params.get('min')),
		maxMs: positiveInt(params.get('max')),
		errorsOnly: params.get('err') === '1'
	};
}

/** Cache key for the fetches that depend on the filters but not on sort or paging. */
export function traceFilterKey(p: TraceParams): string {
	return [
		p.service ?? '',
		p.operation ?? '',
		p.minMs ?? '',
		p.maxMs ?? '',
		p.errorsOnly ? 1 : 0
	].join('|');
}

/**
 * Merges a partial update into the URL. `index` and `timeRange` go through `buildQueryUrl` so the index
 * select and time picker behave exactly as the log explorer's; that serializer emits only the params it
 * owns, so trace params are re-applied on top of its output.
 */
export function buildTraceUrl(
	current: URLSearchParams,
	partial: Partial<TraceParams> & {
		index?: string;
		timeRange?: TimeRange;
		sortDirection?: SortDirection;
	}
): string {
	const base = buildQueryUrl(current, {
		...(partial.index !== undefined && { index: partial.index }),
		...(partial.timeRange !== undefined && { timeRange: partial.timeRange }),
		...(partial.sortDirection !== undefined && { sortDirection: partial.sortDirection })
	});
	const next = new URLSearchParams(base.startsWith('?') ? base.slice(1) : base);

	// Operations are service-scoped, so a stale operation from a prior service would filter on an operation
	// that does not exist in the new service and silently return nothing.
	const serviceChanged = partial.service !== undefined && partial.service !== current.get('svc');

	const merged: TraceParams = {
		...deserializeTraceParams(current),
		...(serviceChanged && { operation: null }),
		...partial
	};

	const set = (key: string, value: string | null): void => {
		if (value === null) next.delete(key);
		else next.set(key, value);
	};

	set('svc', merged.service);
	set('op', merged.operation);
	set('min', merged.minMs === null ? null : String(merged.minMs));
	set('max', merged.maxMs === null ? null : String(merged.maxMs));
	set('err', merged.errorsOnly ? '1' : null);

	const str = next.toString();
	return str ? `?${str}` : '?';
}

/**
 * The one way to link a trace, used by the list rows, the trace-id jump box, and the log drawer.
 * `index` names the log index the trace's span→log links should target; null renders the trace with
 * those links disabled. `returnTo` goes through URLSearchParams because the explorer URL carries `&`.
 */
export function traceDetailHref(
	traceId: string,
	opts: {
		index: string | null;
		returnTo?: { pathname: string; search: string; hash: string };
	}
): string {
	const params = new URLSearchParams();
	if (opts.index !== null) params.set('index', opts.index);
	if (opts.returnTo !== undefined) {
		params.set('returnTo', `${opts.returnTo.pathname}${opts.returnTo.search}${opts.returnTo.hash}`);
	}
	const query = params.toString();
	return query ? `/traces/${traceId}?${query}` : `/traces/${traceId}`;
}
