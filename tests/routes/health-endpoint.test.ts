import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/quickwit', () => ({ getQuickwitClient: () => ({}) }));

import { _createHealthHandler } from '../../src/routes/api/health/+server';

describe('GET /api/health', () => {
	it('returns ready when database and quickwit checks pass', async () => {
		const GET = _createHealthHandler({
			checkDatabase: async () => {
				return;
			},
			checkQuickwit: async () => true
		});

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({
			status: 'ok',
			checks: {
				database: 'ok',
				quickwit: 'ok'
			}
		});
	});

	it('returns not ready when quickwit check fails', async () => {
		const GET = _createHealthHandler({
			checkDatabase: async () => {
				return;
			},
			checkQuickwit: async () => false
		});

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: 'error',
			checks: {
				database: 'ok',
				quickwit: 'error'
			}
		});
	});
});
