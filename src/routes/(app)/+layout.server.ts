import { ConnectionError, TimeoutError } from 'quickwit-js';

import { listIndexesForUser } from '$lib/server/services/index.service';
import type { QuickwitStatus } from '$lib/types';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	try {
		const indexes = await listIndexesForUser(event.locals.user?.role);
		return { indexes, quickwitStatus: 'ok' as QuickwitStatus };
	} catch (e) {
		if (!(e instanceof ConnectionError || e instanceof TimeoutError)) throw e;
		console.error('[layout] Quickwit unreachable:', e);
		return {
			indexes: [],
			quickwitStatus: 'unreachable' as QuickwitStatus,
			quickwitError:
				e instanceof TimeoutError ? 'Quickwit is not responding' : 'Quickwit is unreachable'
		};
	}
};
