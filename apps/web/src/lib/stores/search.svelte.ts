import { goto } from '$app/navigation';
import { page } from '$app/state';
import { toast } from 'svelte-sonner';
import type {
  FieldConfig,
  HistogramBucket,
  HistogramInput,
  IndexOption,
  LevelBucket,
  LogField,
  LogHit,
  ParsedQuery,
  SearchInput,
  TimeRange
} from '$lib/types';
import { searchLogs } from '$lib/api/log-search';
import { fetchHistogram } from '$lib/api/histogram';
import { loadFields } from '$lib/api/fields';
import { getIndexConfig } from '$lib/api/indexes';
import { getPreferences, setPreferences } from '$lib/api/preferences';
import { buildQueryUrl } from '$lib/utils/query-params';
import { normalizeHit } from '$lib/utils/normalize-hit';
import { readLastIndex, writeLastIndex, clearLastIndex } from '$lib/utils/last-index';
import { resolveTimeRange } from '$lib/utils/time-range';

const BATCH_SIZE = 200;

export interface SearchStoreOptions {
  /** Reactive accessor for the URL-derived query. Read inside $effect to subscribe. */
  parsedQuery: () => ParsedQuery;
  initialIndexes: IndexOption[];
  /** Called after each successful fresh (non-append) search; silent prefetches do not trigger it. */
  onFreshSearch?: () => void;
}

export class SearchStore {
  readonly indexes: IndexOption[];

  rawHits = $state<Record<string, unknown>[]>([]);
  numHits = $state(0);
  loading = $state<'idle' | 'fresh' | 'appending'>('idle');
  #prefetching = $state(false);
  searchError = $state<string | null>(null);
  hasSearched = $state(false);

  fieldConfig = $state<FieldConfig | null>(null);
  configError = $state<string | null>(null);

  histogramBuckets = $state<HistogramBucket[]>([]);
  histogramLoading = $state(false);
  histogramError = $state<string | null>(null);

  fields = $state<LogField[]>([]);
  fieldsLoading = $state(false);
  fieldsError = $state<string | null>(null);

  activeFields = $state<string[]>([]);

  levels: LevelBucket[] = $derived.by(() => {
    const totals: Record<string, number> = {};
    for (const b of this.histogramBuckets) {
      for (const [name, count] of Object.entries(b.levels)) {
        totals[name] = (totals[name] ?? 0) + count;
      }
    }
    return Object.entries(totals).map(([name, count]) => ({ name, count }));
  });

  logs: LogHit[] = $derived.by(() => {
    const fc = this.fieldConfig;
    if (!fc) return [];
    return this.rawHits.map((raw, i) => normalizeHit(raw, i, fc));
  });

  #parsedQuery: () => ParsedQuery;
  #onFreshSearch?: () => void;
  #searchRequestId = 0;
  #snapshotStartTs?: number;
  #snapshotEndTs?: number;
  #configRequestId = 0;
  #configFetchedFor: string | null = null;
  #histogramRequestId = 0;
  #fieldsRequestId = 0;
  #fieldsFetchedFor: string | null = null;
  #activeFieldsRequestId = 0;
  #activeFieldsFetchedFor: string | null = null;

  constructor(opts: SearchStoreOptions) {
    this.indexes = opts.initialIndexes;
    this.#parsedQuery = opts.parsedQuery;
    this.#onFreshSearch = opts.onFreshSearch;
  }

  /** URL's index if it's in the indexes list, otherwise the first available (or null). */
  get selectedIndex(): string | null {
    const id = this.#parsedQuery().index;
    return id && this.indexes.some((i) => i.id === id) ? id : (this.indexes[0]?.id ?? null);
  }

  get query() {
    return this.#parsedQuery().query;
  }
  get timeRange() {
    return this.#parsedQuery().timeRange;
  }
  get timezoneMode() {
    return this.#parsedQuery().timezoneMode;
  }
  get sortDirection() {
    return this.#parsedQuery().sortDirection;
  }

  navigateQuery(partial: Partial<ParsedQuery>, opts?: { push?: boolean }): void {
    const url = buildQueryUrl(page.url.searchParams, partial);
    goto(url, { replaceState: !opts?.push, keepFocus: true, noScroll: true });
  }

  runQuery(query: string): void {
    this.navigateQuery({ query }, { push: true });
  }

  handleIndexChange(indexId: string): void {
    this.navigateQuery({ index: indexId }, { push: true });
  }

  toggleSort(): void {
    this.navigateQuery(
      { sortDirection: this.sortDirection === 'desc' ? 'asc' : 'desc' },
      { push: true }
    );
  }

  /**
   * Installs the URL → search() $effect.
   * MUST be called inside component context (not from the constructor).
   */
  setupAutoSearch(): void {
    $effect(() => {
      // Hydration: when URL has no index, use the remembered one (if it's still valid).
      const urlIndex = this.#parsedQuery().index;
      if (urlIndex === null) {
        const remembered = readLastIndex();
        if (remembered && this.indexes.some((i) => i.id === remembered)) {
          this.navigateQuery({ index: remembered });
          return;
        }
        if (remembered) clearLastIndex();
      }

      const active = this.selectedIndex;
      if (active === null) return;

      if (this.#parsedQuery().index !== active) {
        this.navigateQuery({ index: active });
        return;
      }

      if (active !== this.#configFetchedFor) {
        this.#configFetchedFor = active;
        this.#loadConfig(active);
      }

      if (active !== this.#activeFieldsFetchedFor) {
        this.#activeFieldsFetchedFor = active;
        this.#loadActiveFields(active);
      }

      this.#runSearch();
      this.#fetchHistogram();

      // Write-through: remember the converged selection. Runs only when URL matches `active`,
      // so it captures user clicks, programmatic navigations, URL-shared links, and the
      // hydration path itself (which causes the effect to re-run with the new URL).
      writeLastIndex(active);
    });

    // Separate effect: fields depend on fieldConfig + selectedIndex, not on query/time.
    $effect(() => {
      const active = this.selectedIndex;
      const cfg = this.fieldConfig;
      if (active === null || cfg === null) return;

      const key = `${active}|${cfg.isOtel ? '1' : '0'}|${cfg.timestampField}|${cfg.messageField}`;
      if (key === this.#fieldsFetchedFor) return;
      this.#fieldsFetchedFor = key;
      this.#loadFields(active, cfg);
    });
  }

  async #runSearch(mode: 'fresh' | 'append' | 'prefetch' = 'fresh'): Promise<void> {
    if (this.selectedIndex === null) return;

    const silent = mode === 'prefetch';
    const append = mode !== 'fresh';

    const requestId = ++this.#searchRequestId;

    if (silent) {
      this.#prefetching = true;
    } else {
      this.loading = append ? 'appending' : 'fresh';
      this.searchError = null;
    }

    let success = false;

    try {
      let startTs: number | undefined;
      let endTs: number | undefined;

      if (append) {
        startTs = this.#snapshotStartTs;
        endTs = this.#snapshotEndTs;
      } else {
        const resolved = resolveTimeRange({
          timeRange: this.timeRange.type === 'relative' ? this.timeRange.preset : undefined,
          startTimestamp: this.timeRange.type === 'absolute' ? this.timeRange.start : undefined,
          endTimestamp: this.timeRange.type === 'absolute' ? this.timeRange.end : undefined,
        });
        startTs = resolved.startTs;
        endTs = resolved.endTs;
        this.#snapshotStartTs = startTs;
        this.#snapshotEndTs = endTs;
      }

      const result = await searchLogs({
        indexId: this.selectedIndex,
        query: this.query || '*',
        startTimestamp: startTs,
        endTimestamp: endTs,
        sortDirection: this.sortDirection,
        limit: BATCH_SIZE,
        offset: append ? this.rawHits.length : 0,
      });

      if (requestId !== this.#searchRequestId) return;

      if (append) {
        this.rawHits = [...this.rawHits, ...result.rawHits];
      } else {
        this.rawHits = result.rawHits;
        this.hasSearched = true;
        this.#onFreshSearch?.();
      }
      this.numHits = result.numHits;
      success = true;
    } catch (e) {
      if (requestId !== this.#searchRequestId) return;
      // Prefetch errors are swallowed.
      if (silent) return;
      this.searchError = e instanceof Error ? e.message : 'Search failed';
      if (!append) {
        this.rawHits = [];
        this.numHits = 0;
      }
    } finally {
      if (requestId === this.#searchRequestId) {
        this.#prefetching = false;
        if (!silent) this.loading = 'idle';
      }
    }

    // After a fresh search, buffer one page ahead. queueMicrotask defers the
    // recursive call so the 'idle' state propagates before the next request.
    if (success && mode === 'fresh') {
      queueMicrotask(() => {
        if (requestId !== this.#searchRequestId) return;
        if (this.#canFetchMore()) {
          void this.#runSearch('prefetch');
        }
      });
    }
  }

  #canFetchMore(): boolean {
    return this.loading === 'idle' && !this.#prefetching && this.rawHits.length < this.numHits;
  }

  /**
   * Public entry point for scroll-triggered top-ups. Silent append; no-op if
   * a fetch is already in flight, a prefetch is in flight, or all hits are loaded.
   */
  maybeLoadMore(): void {
    if (!this.#canFetchMore()) return;
    void this.#runSearch('prefetch');
  }

  async #fetchHistogram(): Promise<void> {
    if (this.selectedIndex === null) return;

    const requestId = ++this.#histogramRequestId;
    this.histogramLoading = true;
    this.histogramError = null;

    try {
      const result = await fetchHistogram({
        indexId: this.selectedIndex,
        query: this.query || '*',
        ...buildTimeParams(this.timeRange),
      } satisfies HistogramInput);
      if (requestId !== this.#histogramRequestId) return;
      this.histogramBuckets = result.buckets;
    } catch (e) {
      if (requestId !== this.#histogramRequestId) return;
      this.histogramError = e instanceof Error ? e.message : 'Histogram fetch failed';
      this.histogramBuckets = [];
    } finally {
      if (requestId === this.#histogramRequestId) this.histogramLoading = false;
    }
  }

  async #loadConfig(indexId: string): Promise<void> {
    const requestId = ++this.#configRequestId;
    this.fieldConfig = null;
    this.#fieldsFetchedFor = null;
    this.configError = null;
    try {
      const cfg = await getIndexConfig(indexId);
      if (requestId !== this.#configRequestId) return;
      this.fieldConfig = cfg;
    } catch (e) {
      if (requestId !== this.#configRequestId) return;
      this.configError = e instanceof Error ? e.message : 'Failed to load index config';
    }
  }

  /**
   * Re-runs field discovery for the current index. Used by the FieldPanel "Retry"
   * action when an earlier load failed. Resets the cache key so the fields-load
   * effect fires again on the next reactive run.
   */
  reloadFields(): void {
    const cfg = this.fieldConfig;
    const indexId = this.selectedIndex;
    if (!cfg || !indexId) return;
    this.#fieldsFetchedFor = null;
    this.#loadFields(indexId, cfg);
  }

  async #loadFields(indexId: string, fieldConfig: FieldConfig): Promise<void> {
    const requestId = ++this.#fieldsRequestId;
    this.fieldsLoading = true;
    this.fieldsError = null;
    try {
      const fields = await loadFields(indexId, fieldConfig);
      if (requestId !== this.#fieldsRequestId) return;
      this.fields = fields;
    } catch (e) {
      if (requestId !== this.#fieldsRequestId) return;
      this.fieldsError = e instanceof Error ? e.message : 'Failed to load fields';
      this.fields = [];
    } finally {
      if (requestId === this.#fieldsRequestId) this.fieldsLoading = false;
    }
  }

  async #loadActiveFields(indexId: string): Promise<void> {
    const requestId = ++this.#activeFieldsRequestId;
    try {
      const prefs = await getPreferences(indexId);
      if (requestId !== this.#activeFieldsRequestId) return;
      this.activeFields = prefs.displayFields ?? [];
    } catch (e) {
      if (requestId !== this.#activeFieldsRequestId) return;
      // Reset cache key so the effect retries on the next reactive run.
      this.#activeFieldsFetchedFor = null;
      this.activeFields = [];
      toast.error(e instanceof Error ? e.message : 'Failed to load column preferences');
    }
  }

  /**
   * Optimistically updates active fields and persists to the server.
   * Rolls back on failure. Must be called only when `selectedIndex` is non-null.
   */
  setActiveFields(next: string[]): void {
    const indexId = this.selectedIndex;
    if (indexId === null) return;
    const prev = this.activeFields;
    this.activeFields = next;
    setPreferences(indexId, next).catch((e) => {
      this.activeFields = prev;
      toast.error(e instanceof Error ? e.message : 'Failed to save column preferences');
    });
  }
}

function buildTimeParams(
  range: TimeRange
): Pick<SearchInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'> {
  return range.type === 'relative'
    ? { timeRange: range.preset }
    : { startTimestamp: range.start, endTimestamp: range.end };
}
