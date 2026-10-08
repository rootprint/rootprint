import { error } from '@sveltejs/kit';
import type { IndexDetail } from 'api/types';
import type { PageLoad } from './$types';
import {
	getIndexActivityActors,
	getIndexActivityLatency,
	getIndexActivitySummary
} from '#lib/api/activity.js';
import { listApiKeys } from '#lib/api/api-keys.js';
import { DEP } from '#lib/api/deps.js';
import { ApiError } from '#lib/api/errors.js';
import { fetchHistogram } from '#lib/api/histogram.js';
import { getIndex, getIndexDescribe } from '#lib/api/indexes.js';
import type { IndexTabId } from '#lib/types.js';
import { parseWindow } from '#lib/utils/time-range.js';

const DAY_S = 86_400;

function parseTab(raw: string | null): IndexTabId {
	return raw === 'config' || raw === 'fields' || raw === 'sources' ? raw : 'overview';
}

export const load: PageLoad = async ({ params, url, depends }) => {
	depends(DEP.index(params.indexId));
	const { indexId } = params;
	const activeTab = parseTab(url.searchParams.get('tab'));

	// Started before the index fetch so they don't queue behind it; only the histogram and key
	// filter need `detail`.
	const window = activeTab === 'overview' ? parseWindow(url.searchParams.get('window')) : null;
	const early = window && {
		window,
		describe: getIndexDescribe(indexId),
		keys: listApiKeys(),
		latency: getIndexActivityLatency(indexId, window),
		summary: getIndexActivitySummary(indexId, window),
		actors: getIndexActivityActors(indexId, window)
	};

	let detail: IndexDetail;
	try {
		detail = await getIndex(indexId);
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, 'Index not found');
		if (e instanceof ApiError) error(e.status, e.message);
		throw e;
	}

	if (!early) return { detail, activeTab, overview: null };

	const { isTraceIndex } = detail;
	const now = Math.floor(Date.now() / 1000);
	return {
		detail,
		activeTab,
		overview: {
			describe: early.describe,
			// The histogram route rejects the trace index.
			histogram: isTraceIndex
				? null
				: fetchHistogram({ indexId, query: '', startTs: now - DAY_S, endTs: now }),
			// Keys can't target the trace index; /v1/traces routes every key's spans there.
			ingestKeys: early.keys.then((keys) =>
				isTraceIndex ? keys : keys.filter((k) => k.indexId === indexId)
			),
			window: early.window,
			activity: {
				summary: early.summary,
				volume: early.latency.then((buckets) => buckets.map(({ t, count }) => ({ t, count }))),
				latency: early.latency,
				actors: early.actors
			}
		}
	};
};
