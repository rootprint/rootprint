import { error } from '@sveltejs/kit';
import { isTraceId } from 'api/schemas';

import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { getIndexConfig, listIndexes, toLogIndexOptions } from '$lib/api/indexes';
import { fetchTrace } from '$lib/api/traces';
import { SpanLogCounts } from '$lib/components/trace/span-log-counts.svelte';
import { buildTraceModel } from '$lib/components/trace/trace-model';
import { safeReturnTo } from '$lib/return-to';

export const load: PageLoad = async ({ params, url }) => {
	if (!isTraceId(params.traceId)) error(400, 'Not a valid trace id');

	const logIndexId = url.searchParams.get('index');

	try {
		const [trace, fieldConfig, summaries] = await Promise.all([
			fetchTrace(params.traceId),
			logIndexId ? getIndexConfig(logIndexId).catch(() => null) : null,
			// Only feeds the log-index picker, so a failure costs correlation, not the trace.
			listIndexes().catch(() => [])
		]);
		const model = buildTraceModel(trace);
		const logTarget =
			logIndexId !== null && fieldConfig !== null
				? { indexId: logIndexId, traceIdField: fieldConfig.traceIdField }
				: null;

		return {
			traceId: params.traceId,
			indexes: toLogIndexOptions(summaries),
			logIndexId,
			logTarget,
			returnTo: safeReturnTo(url.searchParams.get('returnTo')),
			model,
			truncated: trace.truncated,
			spanLogCounts: logTarget
				? new SpanLogCounts({
						indexId: logTarget.indexId,
						traceIdField: logTarget.traceIdField,
						traceId: params.traceId,
						traceStartMicros: model.traceStartMicros,
						startOffsetMicros: 0,
						durationMicros: model.durationMicros
					})
				: null
		};
	} catch (e) {
		if (e instanceof ApiError) error(e.status, e.message);
		throw e;
	}
};
