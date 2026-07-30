import { fetchSpanLogCounts } from '$lib/api/traces';
import type { TraceLogsTarget } from '$lib/utils/trace-logs';

/**
 * Per-span log counts, resolved in the background.
 */
export class SpanLogCounts {
	counts = $state.raw<ReadonlyMap<string, number> | null>(null);

	constructor(target: Omit<TraceLogsTarget, 'spanId'>) {
		void fetchSpanLogCounts(target)
			.then((counts) => {
				this.counts = counts;
			})
			.catch(() => {
				// A failed count query costs the row icons, nothing else. The header link still works.
			});
	}
}
