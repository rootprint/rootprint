import type { PageLoad } from './$types';

import { getLatency, getSummary, getTopActors } from '$lib/api/activity';
import { parseWindow } from '$lib/utils/time-range';

export const load: PageLoad = async ({ url }) => {
	const window = parseWindow(url.searchParams.get('window'));
	// Issue all panel requests in parallel; the page consumes them with {#await}.
	return {
		window,
		summary: getSummary(window),
		latency: getLatency(window),
		topActors: getTopActors(window)
	};
};
