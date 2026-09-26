import { fetchSpanLogCounts } from '$lib/api/traces';
import type { TraceLogsTarget } from '$lib/utils/trace-logs';

/** `undefined` while in flight, `null` when unavailable; callers must tell them apart. */
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
