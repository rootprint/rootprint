import type { PageLoad } from './$types';

import {
	getApiKeyLatency,
	getApiKeyRecent,
	getApiKeySummary,
	getApiKeyVolume,
	parseWindow
} from '$lib/api/activity';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ url, params, depends }) => {
	depends(DEP.activityApiKey);
	const window = parseWindow(url.searchParams.get('window'));
	const offset = Number(url.searchParams.get('offset') ?? '0');
	const apiKeyId = Number(params.id);
	return {
		window,
		offset,
		apiKeyId,
		summary: getApiKeySummary(apiKeyId, window),
		volume: getApiKeyVolume(apiKeyId, window),
		latency: getApiKeyLatency(apiKeyId, window),
		recent: getApiKeyRecent(apiKeyId, window, { offset, limit: 50 })
	};
};
