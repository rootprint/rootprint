import { json, type RequestHandler } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import { indexesMeta } from '$lib/server/db/schema';
import { quickwitClient } from '$lib/server/quickwit';

type CheckStatus = 'ok' | 'error';

type HealthPayload = {
	status: CheckStatus;
	checks: {
		database: CheckStatus;
		quickwit: CheckStatus;
	};
};

type HealthDependencies = {
	checkDatabase: () => Promise<void>;
	checkQuickwit: () => Promise<boolean>;
};

const defaultDependencies: HealthDependencies = {
	checkDatabase: async () => {
		await db.select({ indexId: indexesMeta.indexId }).from(indexesMeta).limit(1);
	},
	checkQuickwit: async () => quickwitClient.isHealthy()
};

function toStatus(settled: PromiseSettledResult<unknown>, isHealthy: boolean = true): CheckStatus {
	if (settled.status === 'rejected') return 'error';
	return isHealthy ? 'ok' : 'error';
}

async function runHealthChecks(
	dependencies: HealthDependencies = defaultDependencies
): Promise<HealthPayload> {
	const [database, quickwit] = await Promise.allSettled([
		dependencies.checkDatabase(),
		dependencies.checkQuickwit()
	]);

	const checks = {
		database: toStatus(database),
		quickwit: toStatus(quickwit, quickwit.status === 'fulfilled' && quickwit.value)
	};

	return {
		status: checks.database === 'ok' && checks.quickwit === 'ok' ? 'ok' : 'error',
		checks
	};
}

export function _createHealthHandler(
	dependencies: HealthDependencies = defaultDependencies
): RequestHandler {
	return async () => {
		const health = await runHealthChecks(dependencies);

		return json(health, {
			status: health.status === 'ok' ? 200 : 503,
			headers: {
				'cache-control': 'no-store'
			}
		});
	};
}

export const GET: RequestHandler = _createHealthHandler();
