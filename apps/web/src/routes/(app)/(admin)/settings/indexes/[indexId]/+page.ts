import type { PageLoad } from './$types';
import {
	getIndexActivityActors,
	getIndexActivityLatency,
	getIndexActivitySummary
} from '#lib/api/activity.js';
import { listApiKeys } from '#lib/api/api-keys.js';
import { fetchHistogram } from '#lib/api/histogram.js';
import { getIndexDescribe } from '#lib/api/indexes.js';
import { parseWindow } from '#lib/utils/time-range.js';

const DAY_S = 86_400;

export const load: PageLoad = async ({ params, url, parent }) => {
	const { indexId } = params;
	const { isTraceIndex } = (await parent()).detail;
	const window = parseWindow(url.searchParams.get('window'));
	const now = Math.floor(Date.now() / 1000);
	const latency = getIndexActivityLatency(indexId, window);
	return {
		overview: {
			describe: getIndexDescribe(indexId),
			// The histogram route rejects the trace index.
			histogram: isTraceIndex
				? null
				: fetchHistogram({ indexId, query: '', startTs: now - DAY_S, endTs: now }),
			// Keys can't target the trace index; /v1/traces routes every key's spans there.
			ingestKeys: listApiKeys().then((keys) =>
				isTraceIndex ? keys : keys.filter((k) => k.indexId === indexId)
			),
			window,
			activity: {
				summary: getIndexActivitySummary(indexId, window),
				volume: latency.then((buckets) => buckets.map(({ t, count }) => ({ t, count }))),
				latency,
				actors: getIndexActivityActors(indexId, window)
			}
		}
	};
};
