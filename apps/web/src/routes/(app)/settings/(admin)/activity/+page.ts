import type { PageLoad } from './$types';

import { getLatency, getSlowest, getSummary, getTopActors, type Window } from '$lib/api/activity';

function parseWindow(raw: string | null): Window {
	return raw === '24h' || raw === '7d' || raw === '30d' ? raw : '7d';
}

export const load: PageLoad = async ({ url, depends }) => {
	depends('app:activity');
	const window = parseWindow(url.searchParams.get('window'));
	// Issue all panel requests in parallel; the page consumes them with {#await}.
	return {
		window,
		summary: getSummary(window),
		latency: getLatency(window),
		slowest: getSlowest(window),
		topActors: getTopActors(window)
	};
};
