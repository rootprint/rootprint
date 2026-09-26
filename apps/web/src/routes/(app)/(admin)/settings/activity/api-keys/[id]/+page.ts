import type { PageLoad } from './$types';

import {
	ACTIVITY_PAGE_SIZE,
	getApiKeyLatency,
	getApiKeyRecent,
	getApiKeySummary,
	getApiKeyVolume
} from '$lib/api/activity';
import { parseWindow } from '$lib/utils/time-range';
import { parseOffset } from '$lib/utils/search-params';

export const load: PageLoad = async ({ url, params }) => {
	const window = parseWindow(url.searchParams.get('window'));
	const offset = parseOffset(url);
	const apiKeyId = params.id;
	return {
		window,
		offset,
		apiKeyId,
		summary: getApiKeySummary(apiKeyId, window),
		volume: getApiKeyVolume(apiKeyId, window),
		latency: getApiKeyLatency(apiKeyId, window),
		recent: getApiKeyRecent(apiKeyId, window, { offset, limit: ACTIVITY_PAGE_SIZE })
	};
};
