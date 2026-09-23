import { EXPLORE_STATUSES } from 'api/constants';

import type { PageLoad } from './$types';

import { DEP } from '$lib/api/deps';
import { fetchExploreOverview, type ExploreFilters } from '$lib/api/traces';
import { paramOneOf, paramWholeNumber, parseTimeRange } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';

export const load: PageLoad = ({ url, depends }) => {
	depends(DEP.traceExplore);
	const params = url.searchParams;
	// Never read `tab` or `sort` here: SvelteKit reruns load when a param it read changes, and
	// switching tabs or sorting spans must not refetch the overview.
	const timeRange = parseTimeRange(params);
	const { startTs, endTs } = resolveWindow(timeRange);
	const filters: ExploreFilters = {
		startTs,
		endTs,
		service: params.get('service')?.trim() || null,
		operation: params.get('operation')?.trim() || null,
		minMs: paramWholeNumber(params.get('minMs')),
		maxMs: paramWholeNumber(params.get('maxMs')),
		status: paramOneOf(params.get('status'), EXPLORE_STATUSES) ?? 'all',
		root: params.get('root') === 'true',
		q: params.get('q')?.trim() ?? ''
	};

	return { timeRange, filters, overview: fetchExploreOverview(filters) };
};
