import { error } from '@sveltejs/kit';
import { isTraceId } from 'api/schemas';

import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { getIndexConfig } from '$lib/api/indexes';
import { fetchTrace } from '$lib/api/traces';
import { SpanLogCounts } from '$lib/components/trace/span-log-counts.svelte';
import { buildTraceModel } from '$lib/components/trace/trace-model';
import { safeReturnTo } from '$lib/return-to';

export const load: PageLoad = async ({ params, url }) => {
	if (!isTraceId(params.traceId)) throw error(400, 'Not a valid trace id');

	try {
		const [trace, fieldConfig] = await Promise.all([
			fetchTrace(params.indexId, params.traceId),
			getIndexConfig(params.indexId)
		]);
		const model = buildTraceModel(trace);
		return {
			indexId: params.indexId,
			traceId: params.traceId,
			traceIdField: fieldConfig.traceIdField,
			returnTo: safeReturnTo(url.searchParams.get('returnTo')),
			model,
			spanLogCounts: new SpanLogCounts({
				indexId: params.indexId,
				traceIdField: fieldConfig.traceIdField,
				traceId: params.traceId,
				traceStartMicros: model.traceStartMicros,
				startOffsetMicros: 0,
				durationMicros: model.durationMicros
			})
		};
	} catch (e) {
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
};
