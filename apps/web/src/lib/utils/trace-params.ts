import type { ExploreStatus } from 'api/constants';

/** A trace opened from the explorer returns there; any other `returnTo` is a log search. */
export const openedFromExplorer = (returnTo: string | null): boolean =>
	returnTo?.startsWith('/traces') ?? false;

/** `index` is the log index for span→log links; null disables them. */
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
