import type { PageLoad } from './$types';

import {
	getApiKeyLatency,
	getApiKeyRecent,
	getApiKeySummary,
	getApiKeyVolume,
	type Window
} from '$lib/api/activity';

function parseWindow(raw: string | null): Window {
	return raw === '24h' || raw === '7d' || raw === '30d' ? raw : '7d';
}

export const load: PageLoad = async ({ url, params, depends }) => {
	depends('app:activity:api-key');
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
