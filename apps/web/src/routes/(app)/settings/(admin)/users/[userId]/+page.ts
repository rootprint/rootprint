import { error } from '@sveltejs/kit';
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
import { getUser, UserApiError } from '$lib/api/users';

export const load: PageLoad = async ({ url, params, depends, parent }) => {
	depends(DEP.users, DEP.activityUser);
	const window = parseWindow(url.searchParams.get('window'));
	// Guard against a malformed ?offset= (hand-edited or stale link): a NaN offset
	// would 400 the recent request and break the pager math.
	const offsetParam = Number(url.searchParams.get('offset'));
	const offset = Number.isInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;
	const userId = params.userId;

	// Kick the activity requests off before awaiting anything else so they stream in
	// parallel — they only depend on userId/window, not on the resolved user record.
	const summary = getUserSummary(userId, window);
	const volume = getUserVolume(userId, window);
	const latency = getUserLatency(userId, window);
	const indexes = getUserIndexes(userId, window);
	const recent = getUserRecent(userId, window, { offset, limit: 50 });

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
		if (e instanceof UserApiError && e.status === 404) throw error(404, 'User not found');
		if (e instanceof UserApiError) throw error(e.status, e.message);
		throw e;
	}
};
