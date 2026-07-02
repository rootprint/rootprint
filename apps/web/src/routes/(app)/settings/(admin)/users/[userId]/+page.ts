import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

import {
	ACTIVITY_PAGE_SIZE,
	getUserIndexes,
	getUserLatency,
	getUserRecent,
	getUserSummary,
	getUserVolume
} from '$lib/api/activity';
import { parseWindow } from '$lib/utils/time-range';
import { DEP } from '$lib/api/deps';
import { ApiError } from '$lib/api/errors';
import { getUser } from '$lib/api/users';
import { parseOffset } from '$lib/utils/search-params';

export const load: PageLoad = async ({ url, params, depends, parent }) => {
	depends(DEP.users);
	const window = parseWindow(url.searchParams.get('window'));
	const offset = parseOffset(url);
	const userId = params.userId;

	// Kick the activity requests off before awaiting anything else so they stream in
	// parallel — they only depend on userId/window, not on the resolved user record.
	const summary = getUserSummary(userId, window);
	const volume = getUserVolume(userId, window);
	const latency = getUserLatency(userId, window);
	const indexes = getUserIndexes(userId, window);
	const recent = getUserRecent(userId, window, { offset, limit: ACTIVITY_PAGE_SIZE });

	const { session } = await parent();
	try {
		// User identity is resolved (not streamed): the header + actions menu need it.
		const user = await getUser(userId);
		return {
			window,
			offset,
			userId,
			user,
			currentUserId: session?.user.id,
			summary,
			volume,
			latency,
			indexes,
			recent
		};
	} catch (e) {
		// This path won't return the streamed promises; attach no-op catch handlers so
		// their eventual rejection doesn't surface as an unhandled promise rejection.
		for (const p of [summary, volume, latency, indexes, recent]) p.catch(() => {});
		if (e instanceof ApiError && e.status === 404) throw error(404, 'User not found');
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
};
