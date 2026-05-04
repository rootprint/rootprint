import { json, type RequestHandler } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { indexSettings } from '$lib/server/db/schema';
import { quickwitClient } from '$lib/server/quickwit';

type CheckStatus = 'ok' | 'error';

export const GET: RequestHandler = async () => {
	const [database, quickwit] = await Promise.allSettled([
		db.select({ indexId: indexSettings.indexId }).from(indexSettings).limit(1),
		quickwitClient.isHealthy()
	]);

	const checks: { database: CheckStatus; quickwit: CheckStatus } = {
		database: database.status === 'fulfilled' ? 'ok' : 'error',
		quickwit: quickwit.status === 'fulfilled' && quickwit.value ? 'ok' : 'error'
	};

	const status: CheckStatus = checks.database === 'ok' && checks.quickwit === 'ok' ? 'ok' : 'error';

	return json(
		{ status, checks },
		{
			status: status === 'ok' ? 200 : 503,
			headers: { 'cache-control': 'no-store' }
		}
	);
};
