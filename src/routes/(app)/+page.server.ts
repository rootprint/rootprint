import * as historyService from '$lib/server/services/history.service';
import * as savedQueryService from '$lib/server/services/saved-query.service';
import * as viewService from '$lib/server/services/view.service';
import type { HistoryEntry, SavedQueryEntry, SharedQueryEntry, ViewSummary } from '$lib/types';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const indexId = event.url.searchParams.get('index');
	const userId = event.locals.user?.id;

	if (!indexId || !userId) {
		return {
			history: [] as HistoryEntry[],
			savedQueries: [] as SavedQueryEntry[],
			sharedQueries: [] as SharedQueryEntry[],
			views: [] as ViewSummary[]
		};
	}

	const [history, savedQueries, sharedQueries, views] = await Promise.all([
		(historyService.getHistory(userId, indexId) as Promise<HistoryEntry[]>).catch(
			() => [] as HistoryEntry[]
		),
		(savedQueryService.getSavedQueries(userId, indexId) as Promise<SavedQueryEntry[]>).catch(
			() => [] as SavedQueryEntry[]
		),
		(savedQueryService.getSharedQueries(indexId) as Promise<SharedQueryEntry[]>).catch(
			() => [] as SharedQueryEntry[]
		),
		(viewService.getViews(userId, indexId) as Promise<ViewSummary[]>).catch(
			() => [] as ViewSummary[]
		)
	]);

	return { history, savedQueries, sharedQueries, views };
};
