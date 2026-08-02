import { goto } from '$app/navigation';
import { page } from '$app/state';

import { isAbortError } from '$lib/api/errors';
import { fetchTraceHistogram, fetchTraceServices, searchTraces } from '$lib/api/traces';
import type { SortDirection, TimeRange, TraceHistogramResponse, TraceListRow } from '$lib/types';
import { serializeTimeRange } from '$lib/utils/fields';
import { deserialize } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';
import {
	buildTraceUrl,
	deserializeTraceParams,
	traceFilterKey,
	type TraceParams
} from '$lib/utils/trace-params';

const TRACE_BATCH_SIZE = 100;

const TRACE_MAX_ROWS = 2_000;

export interface TraceExplorerOptions {
	searchParams: () => URLSearchParams;
	onFreshSearch?: () => void;
}

export class TraceExplorerStore {
	heatmap = $state.raw<TraceHistogramResponse | null>(null);
	heatmapLoading = $state(false);
	heatmapError = $state<string | null>(null);

	traces = $state.raw<TraceListRow[]>([]);
	tracesLoading = $state(false);
	tracesError = $state<string | null>(null);
	hasSearched = $state(false);

	services = $state.raw<string[]>([]);

	#opts: TraceExplorerOptions;
	#onFreshSearch?: () => void;
	#nonce = $state(0);

	#prefetching = $state(false);
	#lastBatchFull = $state(false);
	/** Hits received, NOT `traces.length`: the server pages by document offset, before dedup. */
	#scanned = 0;
	#byId = new Map<string, TraceListRow>();
	#snapshot: { startTs: number; endTs: number } | null = null;

	#heatmapAbort?: AbortController;
	#heatmapFetchedFor: string | null = null;

	#searchAbort?: AbortController;

	#servicesAbort?: AbortController;
	#servicesFetchedFor: string | null = null;

	constructor(opts: TraceExplorerOptions) {
		this.#opts = opts;
		this.#onFreshSearch = opts.onFreshSearch;
	}

	get timeRange(): TimeRange {
		return deserialize(this.#opts.searchParams()).timeRange;
	}

	get params(): TraceParams {
		return deserializeTraceParams(this.#opts.searchParams());
	}

	get sortDirection(): SortDirection {
		return deserialize(this.#opts.searchParams()).sortDirection;
	}

	toggleSort(): void {
		this.navigate(
			{ sortDirection: this.sortDirection === 'desc' ? 'asc' : 'desc' },
			{ push: true }
		);
	}

	navigate(partial: Parameters<typeof buildTraceUrl>[1], opts?: { push?: boolean }): void {
		void goto(buildTraceUrl(page.url.searchParams, partial), {
			replaceState: !opts?.push,
			keepFocus: true,
			noScroll: true
		});
	}

	refresh(): void {
		this.#nonce++;
	}

	/** MUST be called inside component context (not from the constructor). */
	setupAutoSearch(): void {
		$effect(() => () => this.dispose());

		$effect(() => {
			const range = this.timeRange;
			const params = this.params;
			void this.#nonce;
			void this.#loadHeatmap(range, params);
		});

		$effect(() => {
			const range = this.timeRange;
			const params = this.params;
			const sort = this.sortDirection;
			void this.#nonce;
			void this.#runSearch(range, params, sort, 'fresh');
		});

		$effect(() => {
			void this.#nonce;
			void this.#loadServices(this.timeRange);
		});
	}

	async #loadHeatmap(timeRange: TimeRange, params: TraceParams): Promise<void> {
		// Serialized range, not the resolved {startTs,endTs}: `resolveWindow` re-anchors a relative preset
		// to `now` on every call, so a resolved key would differ every time and never skip anything.
		const fetchKey = `${this.#nonce}|${serializeTimeRange(timeRange)}|${traceFilterKey(params)}`;
		if (fetchKey === this.#heatmapFetchedFor) return;

		this.#heatmapAbort?.abort();
		const ctl = new AbortController();
		this.#heatmapAbort = ctl;

		this.heatmapError = null;
		this.heatmapLoading = true;

		try {
			const { startTs, endTs } = resolveWindow(timeRange);
			const result = await fetchTraceHistogram({ startTs, endTs, ...params }, ctl.signal);
			if (ctl.signal.aborted || this.#heatmapAbort !== ctl) return;
			this.heatmap = result;
			this.#heatmapFetchedFor = fetchKey;
		} catch (e) {
			if (isAbortError(e)) return;
			if (ctl.signal.aborted || this.#heatmapAbort !== ctl) return;
			this.heatmapError = e instanceof Error ? e.message : 'Failed to load traces';
			this.#heatmapFetchedFor = null;
		} finally {
			if (!ctl.signal.aborted && this.#heatmapAbort === ctl) this.heatmapLoading = false;
		}
	}

	/** A short batch is the end-of-results signal. */
	get hasMore(): boolean {
		return this.#lastBatchFull && this.traces.length < TRACE_MAX_ROWS;
	}

	#canFetchMore(): boolean {
		return !this.tracesLoading && !this.#prefetching && this.hasMore;
	}

	maybeLoadMore(): void {
		if (!this.#canFetchMore()) return;
		void this.#runSearch(this.timeRange, this.params, this.sortDirection, 'prefetch');
	}

	async #runSearch(
		timeRange: TimeRange,
		params: TraceParams,
		sortDirection: SortDirection,
		mode: 'fresh' | 'prefetch'
	): Promise<void> {
		const append = mode === 'prefetch';

		this.#searchAbort?.abort();
		const ctl = new AbortController();
		this.#searchAbort = ctl;

		if (append) {
			this.#prefetching = true;
		} else {
			this.#prefetching = false;
			this.tracesError = null;
			this.tracesLoading = true;
		}

		try {
			// Appends reuse the pinned window: re-resolving a relative preset shifts every row's position
			// and duplicates or skips rows at the offset boundary.
			let window: { startTs: number; endTs: number };
			if (append && this.#snapshot !== null) {
				window = this.#snapshot;
			} else {
				window = resolveWindow(timeRange);
				this.#snapshot = window;
			}

			const rows = await searchTraces(
				{
					...window,
					...params,
					limit: TRACE_BATCH_SIZE,
					offset: append ? this.#scanned : 0,
					sortOrder: sortDirection
				},
				ctl.signal
			);
			if (ctl.signal.aborted || this.#searchAbort !== ctl) return;

			this.#scanned = append ? this.#scanned + rows.length : rows.length;
			if (!append) this.#byId.clear();
			for (const row of rows) {
				if (!this.#byId.has(row.traceId)) this.#byId.set(row.traceId, row);
			}
			this.traces = [...this.#byId.values()];
			this.#lastBatchFull = rows.length === TRACE_BATCH_SIZE;
			if (!append) {
				this.hasSearched = true;
				this.#onFreshSearch?.();
			}
		} catch (e) {
			if (isAbortError(e)) return;
			if (ctl.signal.aborted || this.#searchAbort !== ctl) return;
			if (append) return;
			this.tracesError = e instanceof Error ? e.message : 'Trace search failed';
			this.traces = [];
			this.#byId.clear();
			this.#scanned = 0;
			this.#lastBatchFull = false;
		} finally {
			if (!ctl.signal.aborted && this.#searchAbort === ctl) {
				this.#prefetching = false;
				if (!append) this.tracesLoading = false;
			}
		}
	}

	async #loadServices(timeRange: TimeRange): Promise<void> {
		const fetchKey = `${this.#nonce}|${serializeTimeRange(timeRange)}`;
		if (fetchKey === this.#servicesFetchedFor) return;
		this.#servicesAbort?.abort();
		const ctl = new AbortController();
		this.#servicesAbort = ctl;
		this.services = [];
		try {
			const { startTs, endTs } = resolveWindow(timeRange);
			const services = await fetchTraceServices({ startTs, endTs }, ctl.signal);
			if (ctl.signal.aborted || this.#servicesAbort !== ctl) return;
			this.services = services;
			this.#servicesFetchedFor = fetchKey;
		} catch (e) {
			if (isAbortError(e)) return;
			if (ctl.signal.aborted || this.#servicesAbort !== ctl) return;
			this.services = [];
			this.#servicesFetchedFor = null;
		}
	}

	dispose(): void {
		this.#heatmapAbort?.abort();
		this.#searchAbort?.abort();
		this.#servicesAbort?.abort();
	}
}
