import { error, redirect } from '@sveltejs/kit';
import { isTraceId } from 'api/schemas';

import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { getIndexConfig, listIndexes, toLogIndexOptions } from '$lib/api/indexes';
import { fetchTrace } from '$lib/api/traces';
import { SpanLogCounts } from '$lib/components/trace/span-log-counts.svelte';
import { buildTraceModel } from '$lib/components/trace/trace-model';
import { safeReturnTo } from '$lib/return-to';
import type { TraceLogsTarget } from '$lib/utils/trace-logs';

export const load: PageLoad = async ({ params, url }) => {
	if (!isTraceId(params.traceId)) error(400, 'Not a valid trace id');

	const logIndexId = url.searchParams.get('index');

	try {
		const [trace, fieldConfig, summaries] = await Promise.all([
			fetchTrace(params.traceId),
			logIndexId ? getIndexConfig(logIndexId).catch(() => null) : null,
			// Only feeds the log-index picker; a failure mustn't cost the trace.
			listIndexes().catch(() => [])
		]);
		const model = buildTraceModel(trace);
		if (model.spanCount === 0 && url.searchParams.has('pasted')) {
			const back = new URL(safeReturnTo(url.searchParams.get('returnTo')), url);
			back.searchParams.set('q', params.traceId);
			redirect(307, `${back.pathname}${back.search}${back.hash}`);
		}
		const logsTarget: TraceLogsTarget | null =
			logIndexId !== null && fieldConfig !== null
				? {
						indexId: logIndexId,
						traceIdField: fieldConfig.traceIdField,
						traceId: params.traceId,
						traceStartMicros: model.traceStartMicros,
						durationMicros: model.durationMicros
					}
				: null;

		return {
			traceId: params.traceId,
			indexes: toLogIndexOptions(summaries),
			logIndexId,
			logsTarget,
			returnTo: safeReturnTo(url.searchParams.get('returnTo')),
			model,
			truncated: trace.truncated,
			spanLogCounts: logsTarget ? new SpanLogCounts(logsTarget) : null
		};
	} catch (e) {
		if (e instanceof ApiError) error(e.status, e.message);
		throw e;
	}
};
