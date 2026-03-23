import type { PageServerLoad } from './$types';
import type { HistoryEntry, SavedQueryEntry, SharedQueryEntry } from '$lib/types';
import * as historyService from '$lib/server/services/history.service';
import * as savedQueryService from '$lib/server/services/saved-query.service';

export const load: PageServerLoad = async (event) => {
	const indexId = event.url.searchParams.get('index');
	const userId = event.locals.user?.id;

	if (!indexId || !userId) {
		return {
			history: [] as HistoryEntry[],
			savedQueries: [] as SavedQueryEntry[],
			sharedQueries: [] as SharedQueryEntry[]
		};
	}

	const [history, savedQueries, sharedQueries] = await Promise.all([
		(historyService.getHistory(userId, indexId) as Promise<HistoryEntry[]>).catch(
			() => [] as HistoryEntry[]
		),
		(savedQueryService.getSavedQueries(userId, indexId) as Promise<SavedQueryEntry[]>).catch(
			() => [] as SavedQueryEntry[]
		),
		(savedQueryService.getSharedQueries(indexId) as Promise<SharedQueryEntry[]>).catch(
			() => [] as SharedQueryEntry[]
		)
	]);

	return { history, savedQueries, sharedQueries };
};
