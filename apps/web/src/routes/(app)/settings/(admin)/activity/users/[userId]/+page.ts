import type { PageLoad } from './$types';

import {
	getUserIndexes,
	getUserLatency,
	getUserRecent,
	getUserSummary,
	getUserVolume,
	type Window
} from '$lib/api/activity';

function parseWindow(raw: string | null): Window {
	return raw === '24h' || raw === '7d' || raw === '30d' ? raw : '7d';
}

export const load: PageLoad = async ({ url, params, depends }) => {
	depends('app:activity:user');
	const window = parseWindow(url.searchParams.get('window'));
	const offset = Number(url.searchParams.get('offset') ?? '0');
	const userId = params.userId;
	return {
		window,
		offset,
		userId,
		summary: getUserSummary(userId, window),
		volume: getUserVolume(userId, window),
		latency: getUserLatency(userId, window),
		indexes: getUserIndexes(userId, window),
		recent: getUserRecent(userId, window, { offset, limit: 50 })
	};
};
