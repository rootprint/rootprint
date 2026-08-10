import { fetchSpanLogCounts } from '$lib/api/traces';
import type { TraceLogsTarget } from '$lib/utils/trace-logs';

/**
 * Per-span log counts, resolved in the background.
 *
 * `undefined` while in flight, `null` once resolved but unavailable — a caller that treated the two
 * alike would either flash links on every span or drop them for good.
 */
export class SpanLogCounts {
	counts = $state.raw<ReadonlyMap<string, number> | null | undefined>(undefined);

	constructor(target: Omit<TraceLogsTarget, 'spanId'>) {
		void fetchSpanLogCounts(target)
			.then((counts) => {
				this.counts = counts;
			})
			.catch(() => {
				this.counts = null;
			});
	}
}
