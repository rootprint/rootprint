import type { PageLoad } from './$types';

import { getServiceHealth } from '$lib/api/monitoring';
import { deserialize } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';

export const load: PageLoad = ({ url }) => {
	const { timeRange } = deserialize(url.searchParams);
	const { startTs, endTs } = resolveWindow(timeRange);
	const service = url.searchParams.get('service')?.trim() || null;
	const requestedEndpointLimit = Number(url.searchParams.get('endpointLimit'));
	const endpointLimit =
		requestedEndpointLimit === 20 || requestedEndpointLimit === 30 ? requestedEndpointLimit : 10;

	return {
		timeRange,
		service,
		endpointLimit,
		startTs,
		endTs,
		health: getServiceHealth({ service, startTs, endTs, endpointLimit })
	};
};
