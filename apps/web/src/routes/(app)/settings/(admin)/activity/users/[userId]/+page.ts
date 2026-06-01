import type { PageLoad } from './$types';

import {
	getUserIndexes,
	getUserLatency,
	getUserRecent,
	getUserSummary,
	getUserVolume,
	parseWindow
} from '$lib/api/activity';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ url, params, depends }) => {
	depends(DEP.activityUser);
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
