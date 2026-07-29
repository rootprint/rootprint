import { isAbortError } from '$lib/api/errors';
import { fetchTrace } from '$lib/api/traces';
import type { TraceModel } from '$lib/types';
import { buildTraceModel } from './trace-model';

/**
 * Trace fetch for the drawer's Trace tab, where the load has to be lazy (the tab may never be
 * opened) and retryable in place. The standalone route loads in `+page.ts` instead.
 */
export class TraceResource {
	model = $state.raw<TraceModel | null>(null);
	loading = $state(false);
	error = $state<string | null>(null);

	readonly indexId: string;
	readonly traceId: string;
	#abort: AbortController | null = null;

	constructor(indexId: string, traceId: string) {
		this.indexId = indexId;
		this.traceId = traceId;
	}

	async load(): Promise<void> {
		const abort = new AbortController();
		this.#abort?.abort();
		this.#abort = abort;
		this.loading = true;
		this.error = null;
		try {
			const { spans } = await fetchTrace(this.indexId, this.traceId, { signal: abort.signal });
			this.model = buildTraceModel(spans);
		} catch (e) {
			if (isAbortError(e)) return;
			this.error = e instanceof Error ? e.message : 'Failed to load trace';
		} finally {
			// A newer load() owns the state now — a superseded one must not clear its spinner.
			if (this.#abort === abort) this.loading = false;
		}
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}
}
