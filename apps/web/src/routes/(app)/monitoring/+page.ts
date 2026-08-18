import type { PageLoad } from './$types';

import { getServiceHealth } from '$lib/api/monitoring';
import { deserialize } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';

export const load: PageLoad = ({ url }) => {
	const { timeRange } = deserialize(url.searchParams);
	const { startTs, endTs } = resolveWindow(timeRange);
	const service = url.searchParams.get('service');

	return {
		timeRange,
		service,
		startTs,
		endTs,
		health: getServiceHealth({ service, startTs, endTs })
	};
};
