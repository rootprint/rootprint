import type { PageLoad } from './$types';

import { getServiceHealth } from '$lib/api/monitoring';
import { parseTimeRange } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';

const OPERATION_ROWS = 30;

export const load: PageLoad = ({ params, url }) => {
	const timeRange = parseTimeRange(url.searchParams);
	const { startTs, endTs } = resolveWindow(timeRange);

	return {
		timeRange,
		service: params.service,
		startTs,
		endTs,
		health: getServiceHealth({
			service: params.service,
			startTs,
			endTs,
			endpointLimit: OPERATION_ROWS
		})
	};
};
