import { goto } from '$app/navigation';
import { page } from '$app/state';

import { isAbortError } from '$lib/api/errors';
import {
	fetchTraceHistogram,
	fetchTraceOperations,
	fetchTraceServices,
	searchTraces
} from '$lib/api/traces';
import { RequestGuard } from '$lib/stores/request-guard';
import type {
	IndexOption,
	SortDirection,
	TimeRange,
	TraceHistogramResponse,
	TraceListRow
} from '$lib/types';
import { serializeTimeRange } from '$lib/utils/fields';
import { clearLastIndex, readLastIndex, writeLastIndex } from '$lib/utils/last-index';
import { deserialize } from '$lib/utils/query-params';
import { resolveWindow } from '$lib/utils/time-range';
import {
	buildTraceUrl,
	deserializeTraceParams,
	traceFilterKey,
	type TraceParams
} from '$lib/utils/trace-params';

const TRACE_BATCH_SIZE = 100;

// ponytail: 2000 rows because TraceList renders a plain `{#each}`. Raise it once the list virtualizes.
const TRACE_MAX_ROWS = 2_000;

export interface TraceExplorerOptions {
	searchParams: () => URLSearchParams;
	indexes: () => IndexOption[];
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

	/** From the heatmap's summed columns, over a differently-snapped window. Approximate; display only. */
	numHits = $state<number | null>(null);

	services = $state.raw<string[]>([]);
	operations = $state.raw<string[]>([]);
	operationsLoading = $state(false);

	#opts: TraceExplorerOptions;
	#onFreshSearch?: () => void;
	#nonce = $state(0);
	#disposed = false;

	#prefetching = $state(false);
	#lastBatchFull = $state(false);
	/** Hits received, NOT `traces.length`: the server pages by document offset, before dedup. */
	#scanned = 0;
	#byId = new Map<string, TraceListRow>();
	#snapshotStartTs: number | undefined;
	#snapshotEndTs: number | undefined;

	#heatmapAbort?: AbortController;
	#heatmapGuard = new RequestGuard();
	#heatmapFetchedFor: string | null = null;

	#searchAbort?: AbortController;
	#searchGuard = new RequestGuard();
	#searchFetchedFor: string | null = null;

	#servicesAbort?: AbortController;
	#servicesGuard = new RequestGuard();
	#servicesFetchedFor: string | null = null;
	#operationsAbort?: AbortController;
	#operationsGuard = new RequestGuard();
	#operationsFetchedFor: string | null = null;

	constructor(opts: TraceExplorerOptions) {
		this.#opts = opts;
		this.#onFreshSearch = opts.onFreshSearch;
	}

	get indexes(): IndexOption[] {
		return this.#opts.indexes();
	}

	get selectedIndex(): string | null {
		const id = deserialize(this.#opts.searchParams()).index;
		return id !== null && this.indexes.some((i) => i.id === id)
			? id
			: (this.indexes[0]?.id ?? null);
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

	setService(service: string | null): void {
		this.navigate({ service, operation: null }, { push: true });
	}

	refresh(): void {
		this.#nonce++;
		this.#heatmapFetchedFor = null;
		this.#servicesFetchedFor = null;
		this.#operationsFetchedFor = null;
	}

	/** MUST be called inside component context (not from the constructor). */
	setupAutoSearch(): void {
		$effect(() => () => this.dispose());

		$effect(() => {
			const urlIndex = deserialize(this.#opts.searchParams()).index;
			if (urlIndex === null) {
				const remembered = readLastIndex('traces');
				if (remembered !== null && this.indexes.some((i) => i.id === remembered)) {
					this.navigate({ index: remembered });
					return;
				}
				if (remembered !== null) clearLastIndex('traces');
			}

			const indexId = this.selectedIndex;
			if (indexId !== null) {
				if (urlIndex !== indexId) {
					this.navigate({ index: indexId });
					return;
				}
				writeLastIndex('traces', indexId);
			}

			const range = this.timeRange;
			const params = this.params;
			void this.#nonce;
			void this.#loadHeatmap(range, params);
		});

		$effect(() => {
			const indexId = this.selectedIndex;
			if (indexId !== null && deserialize(this.#opts.searchParams()).index !== indexId) return;
			const range = this.timeRange;
			const params = this.params;
			const sort = this.sortDirection;
			// Keyed: this effect also re-runs for URL params the search ignores (the index picker), and
			// re-searching would discard every loaded page.
			const fetchKey = `${this.#nonce}|${serializeTimeRange(range)}|${traceFilterKey(params)}|${sort}`;
			if (fetchKey === this.#searchFetchedFor) return;
			this.#searchFetchedFor = fetchKey;
			void this.#runSearch(range, params, sort, 'fresh');
		});

		$effect(() => {
			void this.#nonce;
			void this.#loadServices(this.timeRange);
		});

		$effect(() => {
			const service = this.params.service;
			void this.#nonce;
			if (service === null) {
				// Abort and invalidate the guard token, or a response resolving after this clear repopulates
				// `operations` for a service that is no longer selected.
				this.#operationsAbort?.abort();
				this.#operationsGuard.next();
				this.#operationsFetchedFor = null;
				this.operations = [];
				this.operationsLoading = false;
				return;
			}
			void this.#loadOperations(service, this.timeRange);
		});
	}

	async #loadHeatmap(timeRange: TimeRange, params: TraceParams): Promise<void> {
		if (this.#disposed) return;
		// Serialized range, not the resolved {startTs,endTs}: `resolveWindow` re-anchors a relative preset
		// to `now` on every call, so a resolved key would differ every time and never skip anything.
		const fetchKey = `${serializeTimeRange(timeRange)}|${traceFilterKey(params)}`;
		if (fetchKey === this.#heatmapFetchedFor) return;

		this.#heatmapAbort?.abort();
		const ctl = new AbortController();
		this.#heatmapAbort = ctl;
		const requestId = this.#heatmapGuard.next();

		this.heatmapError = null;
		this.heatmapLoading = true;
		this.numHits = null;

		try {
			const { startTs, endTs } = resolveWindow(timeRange);
			const result = await fetchTraceHistogram({ startTs, endTs, ...params }, ctl.signal);
			if (!this.#heatmapGuard.isCurrent(requestId)) return;
			this.heatmap = result;
			this.numHits = result.totalCount;
			this.#heatmapFetchedFor = fetchKey;
		} catch (e) {
			if (isAbortError(e)) return;
			if (!this.#heatmapGuard.isCurrent(requestId)) return;
			this.heatmapError = e instanceof Error ? e.message : 'Failed to load traces';
			this.#heatmapFetchedFor = null;
		} finally {
			if (this.#heatmapGuard.isCurrent(requestId)) this.heatmapLoading = false;
		}
	}

	/** A short batch is the only end-of-results signal — `numHits` is the wrong window to page against. */
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
		if (this.#disposed) return;
		const append = mode === 'prefetch';

		this.#searchAbort?.abort();
		const ctl = new AbortController();
		this.#searchAbort = ctl;
		const requestId = this.#searchGuard.next();

		if (append) {
			this.#prefetching = true;
		} else {
			this.tracesError = null;
			this.tracesLoading = true;
		}

		try {
			// Appends reuse the pinned window: re-resolving a relative preset shifts every row's position
			// and duplicates or skips rows at the offset boundary.
			let startTs: number;
			let endTs: number;
			if (append && this.#snapshotStartTs !== undefined && this.#snapshotEndTs !== undefined) {
				startTs = this.#snapshotStartTs;
				endTs = this.#snapshotEndTs;
			} else {
				const resolved = resolveWindow(timeRange);
				startTs = resolved.startTs;
				endTs = resolved.endTs;
				this.#snapshotStartTs = startTs;
				this.#snapshotEndTs = endTs;
			}

			const rows = await searchTraces(
				{
					startTs,
					endTs,
					...params,
					limit: TRACE_BATCH_SIZE,
					offset: append ? this.#scanned : 0,
					sortOrder: sortDirection
				},
				ctl.signal
			);
			if (!this.#searchGuard.isCurrent(requestId)) return;

			this.#scanned = append ? this.#scanned + rows.length : rows.length;
			if (!append) this.#byId.clear();
			// ponytail: dedup is silent — an enumeration of 4,913 root documents found 4,913 distinct
			// trace ids, so multi-root traces do not occur here. Add a badge when one is observed.
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
			if (!this.#searchGuard.isCurrent(requestId)) return;
			if (append) return;
			this.tracesError = e instanceof Error ? e.message : 'Trace search failed';
			this.traces = [];
			this.#byId.clear();
			this.#scanned = 0;
			this.#lastBatchFull = false;
			this.#searchFetchedFor = null;
		} finally {
			if (this.#searchGuard.isCurrent(requestId)) {
				this.#prefetching = false;
				if (!append) this.tracesLoading = false;
			}
		}
	}

	async #loadServices(timeRange: TimeRange): Promise<void> {
		if (this.#disposed) return;
		const fetchKey = serializeTimeRange(timeRange);
		if (fetchKey === this.#servicesFetchedFor) return;
		this.#servicesAbort?.abort();
		const ctl = new AbortController();
		this.#servicesAbort = ctl;
		const requestId = this.#servicesGuard.next();
		this.services = [];
		try {
			const { startTs, endTs } = resolveWindow(timeRange);
			const services = await fetchTraceServices({ startTs, endTs }, ctl.signal);
			if (!this.#servicesGuard.isCurrent(requestId)) return;
			this.services = services;
			this.#servicesFetchedFor = fetchKey;
		} catch (e) {
			if (isAbortError(e)) return;
			if (!this.#servicesGuard.isCurrent(requestId)) return;
			this.services = [];
			this.#servicesFetchedFor = null;
		}
	}

	async #loadOperations(service: string, timeRange: TimeRange): Promise<void> {
		if (this.#disposed) return;
		const fetchKey = `${service}|${serializeTimeRange(timeRange)}`;
		if (fetchKey === this.#operationsFetchedFor) return;
		this.#operationsAbort?.abort();
		const ctl = new AbortController();
		this.#operationsAbort = ctl;
		const requestId = this.#operationsGuard.next();
		this.operationsLoading = true;
		try {
			const { startTs, endTs } = resolveWindow(timeRange);
			const operations = await fetchTraceOperations(service, { startTs, endTs }, ctl.signal);
			if (!this.#operationsGuard.isCurrent(requestId)) return;
			this.operations = operations;
			this.#operationsFetchedFor = fetchKey;
		} catch (e) {
			if (isAbortError(e)) return;
			if (!this.#operationsGuard.isCurrent(requestId)) return;
			this.operations = [];
			this.#operationsFetchedFor = null;
		} finally {
			if (this.#operationsGuard.isCurrent(requestId)) this.operationsLoading = false;
		}
	}

	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#heatmapAbort?.abort();
		this.#searchAbort?.abort();
		this.#servicesAbort?.abort();
		this.#operationsAbort?.abort();
	}
}
