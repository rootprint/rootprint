import type { ExploreStatus } from 'api/constants';
import { preloadData } from '$app/navigation';
import type { TraceModel } from '$lib/types';

export type TraceOrigin = 'traces' | 'monitoring' | 'search';

/** The page a trace was opened from, by its `returnTo`; anything else is a log search. */
export function traceOrigin(returnTo: string | null): TraceOrigin {
	if (returnTo?.startsWith('/traces')) return 'traces';
	if (returnTo?.startsWith('/monitoring')) return 'monitoring';
	return 'search';
}

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

/**
 * MD5s and dashless UUIDs are also 32 hex chars, so a pasted id opens the trace only if it has spans;
 * otherwise the caller searches it as text. Preloading means `goto(href)` reuses this fetch.
 */
export async function traceHasSpans(href: string): Promise<boolean> {
	const result = await preloadData(href).catch(() => null);
	if (result?.type !== 'loaded') return false;
	const model = result.data.model as TraceModel | undefined;
	return (model?.spanCount ?? 0) > 0;
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
