import type { PageLoad } from './$types';

import { getLatency, getSlowest, getSummary, getTopActors, parseWindow } from '$lib/api/activity';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ url, depends }) => {
	depends(DEP.activity);
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
