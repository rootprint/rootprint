import { error } from '@sveltejs/kit';
import { isTraceId } from 'api/schemas';

import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { fetchTrace } from '$lib/api/traces';
import { buildTraceModel } from '$lib/components/trace/trace-model';
import { safeReturnTo } from '$lib/return-to';

export const load: PageLoad = async ({ params, url }) => {
	if (!isTraceId(params.traceId)) throw error(400, 'Not a valid trace id');

	try {
		const trace = await fetchTrace(params.indexId, params.traceId);
		return {
			indexId: params.indexId,
			traceId: params.traceId,
			returnTo: safeReturnTo(url.searchParams.get('returnTo')),
			model: buildTraceModel(trace)
		};
	} catch (e) {
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
};
