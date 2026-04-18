import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/middleware/auth', () => ({
	requireAdmin: vi.fn()
}));

vi.mock('$lib/server/services/index.service', () => ({
	getAdminIndexDetail: vi.fn()
}));

vi.mock('$lib/server/services/index-stats.service', () => ({
	getIndexStatsCard: vi.fn()
}));

import { requireAdmin } from '$lib/middleware/auth';
import * as indexService from '$lib/server/services/index.service';
import * as indexStatsService from '$lib/server/services/index-stats.service';

const getAdminIndexDetail = vi.mocked(
	(indexService as unknown as { getAdminIndexDetail: ReturnType<typeof vi.fn> }).getAdminIndexDetail
);
const getIndexStatsCard = vi.mocked(
	(indexStatsService as unknown as { getIndexStatsCard: ReturnType<typeof vi.fn> })
		.getIndexStatsCard
);
const administrationLayoutRouteModulePath = '../../src/routes/(app)/administration/+layout.server';
const indexDetailRouteModulePath =
	'../../src/routes/(app)/administration/indexes/[indexId]/+page.server';

describe('administration route loads', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('requires admin access for administration routes from the layout loader', async () => {
		const { load } = await import(administrationLayoutRouteModulePath);

		await expect(load({} as Parameters<typeof load>[0])).resolves.toEqual({});
		expect(requireAdmin).toHaveBeenCalledOnce();
	});

	it('redirects the administration root to the send-logs page', async () => {
		const { load } = await import('../../src/routes/(app)/administration/+page.server');

		await expect(load({} as Parameters<typeof load>[0])).rejects.toMatchObject({
			status: 302,
			location: '/administration/send-logs'
		});
	});

	it('loads a requested administration index detail', async () => {
		const detail = {
			indexId: 'logs',
			indexUid: 'logs:1',
			indexUri: 's3://logs',
			version: '0.8',
			createTimestamp: 1710000000,
			timestampField: 'timestamp',
			mode: 'dynamic',
			indexFieldPresence: true,
			storeSource: true,
			storeDocumentSize: false,
			tagFields: ['service'],
			defaultSearchFields: ['message'],
			retention: null,
			levelField: 'level',
			messageField: 'message',
			tracebackField: 'traceback',
			displayName: 'Logs',
			visibility: 'all',
			contextFields: ['service.name'],
			fields: [],
			sources: []
		};

		const stats = {
			ingestion24h: { value: 100, deltaPct: 5 },
			size: { bytes: 1024, numSplits: 2, compressionRatio: 3.4 }
		};

		getAdminIndexDetail.mockResolvedValue(detail);
		getIndexStatsCard.mockResolvedValue(stats);

		const { load } = await import(indexDetailRouteModulePath);

		await expect(
			load({ params: { indexId: 'logs' } } as Parameters<typeof load>[0])
		).resolves.toEqual({ detail, stats });
		expect(getAdminIndexDetail).toHaveBeenCalledWith('logs');
		expect(getIndexStatsCard).toHaveBeenCalledWith('logs');
	});

	it('returns 404 when the requested administration index detail is missing', async () => {
		getAdminIndexDetail.mockResolvedValue(null);
		getIndexStatsCard.mockResolvedValue(null);

		const { load } = await import(indexDetailRouteModulePath);

		await expect(
			load({ params: { indexId: 'missing' } } as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 404
		});
	});
});
