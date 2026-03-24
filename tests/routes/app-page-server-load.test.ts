import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryEntry, SharedQueryEntry } from '$lib/types';

vi.mock('$lib/server/services/history.service', () => ({
	getHistory: vi.fn()
}));

vi.mock('$lib/server/services/saved-query.service', () => ({
	getSavedQueries: vi.fn(),
	getSharedQueries: vi.fn()
}));

import { load } from '../../src/routes/(app)/+page.server';
import * as historyService from '$lib/server/services/history.service';
import * as savedQueryService from '$lib/server/services/saved-query.service';

describe('+page.server load', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('keeps page load successful when a drawer query fails', async () => {
		const history: HistoryEntry[] = [
			{
				id: 1,
				userId: 'user-1',
				indexName: 'logs',
				query: 'level:error',
				timeRange: { type: 'relative', preset: '15m' },
				executedAt: new Date('2026-01-01T00:00:00.000Z')
			}
		];

		const sharedQueries: SharedQueryEntry[] = [
			{
				id: 2,
				userId: 'user-2',
				indexName: 'logs',
				name: 'Errors',
				description: null,
				query: 'level:error',
				username: 'alice',
				createdAt: new Date('2026-01-01T00:01:00.000Z')
			}
		];

		vi.mocked(historyService.getHistory).mockResolvedValue(history);
		vi.mocked(savedQueryService.getSavedQueries).mockRejectedValue(new Error('db unavailable'));
		vi.mocked(savedQueryService.getSharedQueries).mockResolvedValue(sharedQueries);

		const event = {
			url: new URL('https://example.test/?index=logs'),
			locals: { user: { id: 'user-1' } }
		} as Parameters<typeof load>[0];

		await expect(load(event)).resolves.toEqual({
			history,
			savedQueries: [],
			sharedQueries
		});
	});
});
