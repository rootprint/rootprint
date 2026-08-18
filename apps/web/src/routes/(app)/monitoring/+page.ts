import type { PageLoad } from './$types';

import { getServiceHealth } from '$lib/api/monitoring';
import { deserialize } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';

export const load: PageLoad = ({ url }) => {
	const { timeRange } = deserialize(url.searchParams);
	const { startTs, endTs } = resolveWindow(timeRange);
	const service = url.searchParams.get('service')?.trim() || null;
	// Any positive count is passed through — the API caps it. The row buttons just show none active.
	const requested = Number(url.searchParams.get('endpointLimit'));
	const endpointLimit = Number.isInteger(requested) && requested > 0 ? requested : 10;

	return {
		timeRange,
		service,
		endpointLimit,
		startTs,
		endTs,
		health: getServiceHealth({ service, startTs, endTs, endpointLimit })
	};
};
