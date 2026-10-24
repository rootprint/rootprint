import type { PageLoad } from './$types';

import { getLatency, getRecent, getSummary } from '#lib/api/activity.js';
import { parseWindow } from '#lib/utils/time-range.js';
import { parseOffset } from '#lib/components/settings/search-params.js';

export const load: PageLoad = async ({ url, params }) => {
	const window = parseWindow(url.searchParams.get('window'));
	const offset = parseOffset(url);
	const apiKeyId = params.id;
	const query = { window, apiKey: apiKeyId };
	return {
		window,
		offset,
		apiKeyId,
		summary: getSummary(query),
		latency: getLatency(query),
		recent: getRecent(query, offset)
	};
};
