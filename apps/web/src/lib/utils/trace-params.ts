import type { ExploreStatus } from 'api/constants';

export type TraceOrigin = 'traces' | 'services' | 'logs';

/** The page a trace was opened from, by its `returnTo`; anything else is the log explorer. */
export function traceOrigin(returnTo: string | null): TraceOrigin {
	if (returnTo?.startsWith('/traces')) return 'traces';
	if (returnTo?.startsWith('/services')) return 'services';
	return 'logs';
}

/**
 * `index` is the log index for span→log links; null disables them. `pasted` marks an id typed into a
 * search box: MD5s and dashless UUIDs are also 32 hex chars, so the trace page sends one with no spans
 * back to `returnTo` as a text search.
 */
export function traceDetailHref(
	traceId: string,
	opts: {
		index: string | null;
		returnTo?: { pathname: string; search: string; hash: string };
		span?: string;
		pasted?: boolean;
	}
): string {
	const params = new URLSearchParams();
	if (opts.index !== null) params.set('index', opts.index);
	if (opts.span !== undefined) params.set('span', opts.span);
	if (opts.pasted) params.set('pasted', '1');
	if (opts.returnTo !== undefined) {
		params.set('returnTo', `${opts.returnTo.pathname}${opts.returnTo.search}${opts.returnTo.hash}`);
	}
	const query = params.toString();
	const path = `/traces/${encodeURIComponent(traceId)}`;
	return query ? `${path}?${query}` : path;
}

export type ExploreLinkFilters = Partial<Record<'service' | 'operation' | 'q', string | null>> & {
	status?: ExploreStatus;
};

export function exploreHref(current: URL, filters: ExploreLinkFilters): string {
	const params = new URLSearchParams();
	for (const key of ['from', 'to']) {
		const value = current.searchParams.get(key);
		if (value !== null) params.set(key, value);
	}
	for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
	const query = params.toString();
	return query ? `/traces?${query}` : '/traces';
}
