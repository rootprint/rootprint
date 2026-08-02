import { goto } from '$app/navigation';
import { page } from '$app/state';

import { isAbortError } from '$lib/api/errors';
import { fetchTraceHistogram, fetchTraceServices, searchSpans } from '$lib/api/traces';
import type { SortDirection, SpanListRow, TimeRange, TraceHistogramResponse } from '$lib/types';
import { serializeTimeRange } from '$lib/utils/fields';
import { deserialize } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';
import {
	buildTraceUrl,
	deserializeTraceParams,
	traceFilterKey,
	type TraceParams
} from '$lib/utils/trace-params';

const SPAN_BATCH_SIZE = 100;

const SPAN_MAX_ROWS = 10_000;

/** Mirrors the `offset` ceiling in apps/api/src/schemas/traces.ts; past it the API 400s. */
const OFFSET_CEILING = 10_000;

export interface TraceExplorerOptions {
	searchParams: () => URLSearchParams;
	onFreshSearch?: () => void;
}

export class TraceExplorerStore {
	heatmap = $state.raw<TraceHistogramResponse | null>(null);
	heatmapLoading = $state(false);
	heatmapError = $state<string | null>(null);

	spans = $state.raw<SpanListRow[]>([]);
	spansLoading = $state(false);
	spansError = $state<string | null>(null);
	hasSearched = $state(false);

	services = $state.raw<string[]>([]);

	#opts: TraceExplorerOptions;
	#onFreshSearch?: () => void;
	#nonce = $state(0);

	#prefetching = $state(false);
	#lastBatchFull = $state(false);
	/** Documents received, NOT `spans.length`: the server pages by document offset, before dedup. */
	#scanned = 0;
	/**
	 * OTLP delivery is at-least-once and Quickwit has no upsert, so retries write duplicate documents
	 * for one logical span. `span_id` alone is not enough — it is 8 bytes and unique only within a trace.
	 */
	#byId = new Map<string, SpanListRow>();
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
			this.heatmapError = e instanceof Error ? e.message : 'Failed to load the heatmap';
			this.#heatmapFetchedFor = null;
		} finally {
			if (!ctl.signal.aborted && this.#heatmapAbort === ctl) this.heatmapLoading = false;
		}
	}

	/** A short batch is the end-of-results signal. */
	get hasMore(): boolean {
		return (
			this.#lastBatchFull &&
			this.spans.length < SPAN_MAX_ROWS &&
			this.#scanned + SPAN_BATCH_SIZE <= OFFSET_CEILING
		);
	}

	#canFetchMore(): boolean {
		return !this.spansLoading && !this.#prefetching && this.hasMore;
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
			this.spansError = null;
			this.spansLoading = true;
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

			const rows = await searchSpans(
				{
					...window,
					...params,
					limit: SPAN_BATCH_SIZE,
					offset: append ? this.#scanned : 0,
					sortOrder: sortDirection
				},
				ctl.signal
			);
			if (ctl.signal.aborted || this.#searchAbort !== ctl) return;

			this.#scanned = append ? this.#scanned + rows.length : rows.length;
			if (!append) this.#byId.clear();
			for (const row of rows) {
				const key = `${row.traceId}:${row.spanId}`;
				if (!this.#byId.has(key)) this.#byId.set(key, row);
			}
			this.spans = [...this.#byId.values()];
			this.#lastBatchFull = rows.length === SPAN_BATCH_SIZE;
			if (!append) {
				this.hasSearched = true;
				this.#onFreshSearch?.();
			}
		} catch (e) {
			if (isAbortError(e)) return;
			if (ctl.signal.aborted || this.#searchAbort !== ctl) return;
			if (append) return;
			this.spansError = e instanceof Error ? e.message : 'Span search failed';
			this.spans = [];
			this.#byId.clear();
			this.#scanned = 0;
			this.#lastBatchFull = false;
		} finally {
			if (!ctl.signal.aborted && this.#searchAbort === ctl) {
				this.#prefetching = false;
				if (!append) this.spansLoading = false;
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
