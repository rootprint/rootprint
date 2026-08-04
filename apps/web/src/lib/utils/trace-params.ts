import type { SortDirection, TimeRange } from '$lib/types';
import { buildQueryUrl } from '$lib/utils/query-params';

export interface TraceParams {
	service: string | null;
	q: string;
}

export function deserializeTraceParams(params: URLSearchParams): TraceParams {
	return {
		service: params.get('svc') || null,
		q: params.get('q') ?? ''
	};
}

/** Cache key for the fetches that depend on the filters but not on sort or paging. */
export function traceFilterKey(p: TraceParams): string {
	return `${p.service ?? ''}|${p.q}`;
}

const DURATION_CLAUSE_RE = /^(?:\((.*)\) AND )?span_duration_millis:\[(?:\d+|\*) TO (?:\d+|\*)\}$/;

export function stripDurationClause(q: string): string {
	const match = DURATION_CLAUSE_RE.exec(q.trim());
	return match ? (match[1] ?? '') : q;
}

/** Open-ended bands pass `null`, which becomes `*`. Upper bound is exclusive: bands are `[from, to)`. */
export function withDurationClause(q: string, fromMs: number | null, toMs: number | null): string {
	const rest = stripDurationClause(q).trim();
	const clause = `span_duration_millis:[${fromMs ?? '*'} TO ${toMs ?? '*'}}`;
	return rest === '' ? clause : `(${rest}) AND ${clause}`;
}

/**
 * Merges a partial update into the URL. `timeRange` goes through `buildQueryUrl` so the time picker
 * behaves exactly as the log explorer's; that serializer emits only the params it owns, so trace
 * params are re-applied on top of its output. `index` is always `null` — the trace explorer has no
 * index of its own to serialize; the log index lives only on the detail page. `buildQueryUrl` also
 * owns `q` as the log explorer's query param, so trace `q` passes through that serializer before
 * being overwritten below; that's safe only because both sides read the same `current.get('q')`,
 * making the overwrite idempotent — a non-empty default or a transform on `ParsedQuery.query` in
 * `serialize` would break trace URLs silently.
 */
export function buildTraceUrl(
	current: URLSearchParams,
	partial: Partial<TraceParams> & {
		timeRange?: TimeRange;
		sortDirection?: SortDirection;
	}
): string {
	const base = buildQueryUrl(current, {
		index: null,
		...(partial.timeRange !== undefined && { timeRange: partial.timeRange }),
		...(partial.sortDirection !== undefined && { sortDirection: partial.sortDirection })
	});
	const next = new URLSearchParams(base.startsWith('?') ? base.slice(1) : base);

	const merged: TraceParams = { ...deserializeTraceParams(current), ...partial };

	const set = (key: string, value: string | null): void => {
		if (value === null) next.delete(key);
		else next.set(key, value);
	};

	set('svc', merged.service);
	set('q', merged.q === '' ? null : merged.q);

	const str = next.toString();
	return str ? `?${str}` : '?';
}

/**
 * The one way to link a trace, used by the span list, the query box and the log drawer.
 * `index` names the log index the trace's span→log links should target; null renders the trace with
 * those links disabled. `span` preselects a span in the waterfall, so a row that matched a query opens
 * on the span that matched rather than on the root. `returnTo` goes through URLSearchParams because
 * the explorer URL carries `&`.
 */
export function traceDetailHref(
	traceId: string,
	opts: {
		index: string | null;
		returnTo?: { pathname: string; search: string; hash: string };
		span?: string;
	}
): string {
	const params = new URLSearchParams();
	if (opts.index !== null) params.set('index', opts.index);
	if (opts.span !== undefined) params.set('span', opts.span);
	if (opts.returnTo !== undefined) {
		params.set('returnTo', `${opts.returnTo.pathname}${opts.returnTo.search}${opts.returnTo.hash}`);
	}
	const query = params.toString();
	return query ? `/traces/${traceId}?${query}` : `/traces/${traceId}`;
}
