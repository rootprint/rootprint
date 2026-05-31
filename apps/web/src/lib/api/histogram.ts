import { getUnixTime } from 'date-fns';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { HistogramBucket, HistogramInput, HistogramResult } from '$lib/types';
import {
	computeHistogramIntervalSeconds,
	formatInterval,
	padHistogramBuckets
} from '$lib/utils/histogram';
import { resolveTimeRange } from '$lib/utils/time-range';

const DEFAULT_WINDOW_SECONDS = 15 * 60;

export async function fetchHistogram(
	input: HistogramInput,
	signal?: AbortSignal
): Promise<HistogramResult> {
	const resolved = resolveTimeRange(input);
	const endSec = resolved.endTs ?? getUnixTime(new Date());
	const startSec = resolved.startTs ?? endSec - DEFAULT_WINDOW_SECONDS;
	const intervalSec = computeHistogramIntervalSeconds(endSec - startSec);
	const interval = formatInterval(intervalSec);

	const res = await client.api.indexes[':indexId'].logs.histogram.$get(
		{
			param: { indexId: input.indexId },
			query: {
				q: input.query,
				startTs: String(startSec),
				endTs: String(endSec),
				interval
			}
		},
		{ init: { signal } }
	);
	if (!res.ok) throw await readApiError(res, 'Histogram fetch failed');
	const json = await res.json();

	// Quickwit's date_histogram returns `key` in ms; normalize to seconds.
	const bucketMap = new Map<number, { levels: Record<string, number>; count: number }>();
	for (const b of json.buckets) {
		bucketMap.set(Math.floor(b.key / 1000), { levels: b.levels, count: b.docCount });
	}

	const buckets: HistogramBucket[] = padHistogramBuckets(bucketMap, startSec, endSec, intervalSec);
	return { buckets };
}
