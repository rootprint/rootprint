import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

import { getIndexUsage, getLatency, getRecent, getSummary } from '#lib/api/activity.js';
import { parseWindow } from '#lib/utils/time-range.js';
import { DEP } from '#lib/api/deps.js';
import { ApiError } from '#lib/api/errors.js';
import { getUser } from '#lib/api/users.js';
import { parseOffset } from '#lib/components/settings/search-params.js';

export const load: PageLoad = async ({ url, params, depends, parent }) => {
	depends(DEP.users);
	const window = parseWindow(url.searchParams.get('window'));
	const offset = parseOffset(url);
	const userId = params.userId;

	// Kick the activity requests off before awaiting anything else so they stream in
	// parallel — they only depend on userId/window, not on the resolved user record.
	const query = { window, user: userId };
	const summary = getSummary(query);
	const latency = getLatency(query);
	const indexes = getIndexUsage(query);
	const recent = getRecent(query, offset);

	try {
		// User identity is resolved (not streamed): the header + actions menu need it.
		const [{ session }, user] = await Promise.all([parent(), getUser(userId)]);
		return {
			window,
			offset,
			userId,
			user,
			currentUserId: session?.user.id,
			summary,
			latency,
			indexes,
			recent
		};
	} catch (e) {
		// This path won't return the streamed promises; attach no-op catch handlers so
		// their eventual rejection doesn't surface as an unhandled promise rejection.
		for (const p of [summary, latency, indexes, recent]) p.catch(() => {});
		if (e instanceof ApiError && e.status === 404) error(404, 'User not found');
		if (e instanceof ApiError) error(e.status, e.message);
		throw e;
	}
};
