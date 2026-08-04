/**
 * The one way to link a trace, used by the log query box and the log drawer.
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
