import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

import { getServiceHealth } from '$lib/api/services';
import { parseTimeRange } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';

export const load: PageLoad = ({ url }) => {
	// `?service=` scoped this page before each service had its own; keeps those links working.
	const service = url.searchParams.get('service')?.trim();
	if (service) {
		const params = new URLSearchParams(url.searchParams);
		params.delete('service');
		params.delete('view');
		const query = params.toString();
		redirect(307, `/services/${encodeURIComponent(service)}${query ? `?${query}` : ''}`);
	}

	const timeRange = parseTimeRange(url.searchParams);
	const { startTs, endTs } = resolveWindow(timeRange);

	return {
		timeRange,
		startTs,
		endTs,
		health: getServiceHealth({ service: null, startTs, endTs, endpointLimit: 0 })
	};
};
