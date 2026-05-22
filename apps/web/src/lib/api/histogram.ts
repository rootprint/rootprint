import { client } from '$lib/api/client';
import type { HistogramBucket, HistogramInput, HistogramResult } from '$lib/types';
import {
  computeHistogramIntervalSeconds,
  formatInterval,
  padHistogramBuckets,
} from '$lib/utils/histogram';
import { resolveTimeRange } from '$lib/utils/time-range';

const DEFAULT_WINDOW_SECONDS = 15 * 60;

export async function fetchHistogram(input: HistogramInput): Promise<HistogramResult> {
  const resolved = resolveTimeRange(input);
  const endSec = resolved.endTs ?? Math.floor(Date.now() / 1000);
  const startSec = resolved.startTs ?? endSec - DEFAULT_WINDOW_SECONDS;
  const intervalSec = computeHistogramIntervalSeconds(endSec - startSec);
  const interval = formatInterval(intervalSec);

  const res = await client.api.indexes[':indexId'].logs.histogram.$get({
    param: { indexId: input.indexId },
    query: {
      q: input.query,
      startTs: String(startSec),
      endTs: String(endSec),
      interval,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(body?.error?.message ?? `Histogram fetch failed (${res.status})`);
  }
  const json = await res.json();

  // Quickwit's date_histogram returns `key` in ms; normalize to seconds.
  const bucketMap = new Map<number, { levels: Record<string, number>; count: number }>();
  for (const b of json.buckets) {
    bucketMap.set(Math.floor(b.key / 1000), { levels: b.levels, count: b.docCount });
  }

  const buckets: HistogramBucket[] = padHistogramBuckets(
    bucketMap,
    startSec,
    endSec,
    intervalSec
  );
  return { buckets };
}
