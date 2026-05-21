import { goto } from '$app/navigation';
import { page } from '$app/state';
import type {
  FieldConfig,
  HistogramBucket,
  HistogramFn,
  HistogramInput,
  IndexOption,
  LevelBucket,
  LoadFieldsFn,
  LogField,
  LogHit,
  ParsedQuery,
  SearchFn,
  SearchInput,
  TimeRange
} from '$lib/types';
import { buildQueryUrl } from '$lib/utils/query-params';
import { normalizeHit } from '$lib/utils/normalize-hit';

const BATCH_SIZE = 50;

export interface SearchStoreOptions {
  /** Reactive accessor for the URL-derived query. Read inside $effect to subscribe. */
  parsedQuery: () => ParsedQuery;
  initialIndexes: IndexOption[];
  /**
   * Runs a log search. Injected by the page load — the store has no $lib/api import.
   */
  searchFn: SearchFn;
  /**
   * Runs a stacked-by-level histogram fetch. Injected by the page load.
   */
  histogramFn: HistogramFn;
  /**
   * Fetches the field-name mappings for an index. Called once per active-index change.
   * Injected by the page load — the store has no $lib/api import.
   */
  loadConfig: (indexId: string) => Promise<FieldConfig>;
  /**
   * Fetches the field list for an index. Called whenever (selectedIndex, fieldConfig)
   * change. Injected by the page load — the store has no $lib/api import.
   */
  loadFields: LoadFieldsFn;
}

export class SearchStore {
  readonly indexes: IndexOption[];

  rawHits = $state<Record<string, unknown>[]>([]);
  numHits = $state(0);
  loading = $state<'idle' | 'fresh'>('idle');
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
  #searchFn: SearchFn;
  #loadConfigFn: (indexId: string) => Promise<FieldConfig>;
  #searchRequestId = 0;
  #configRequestId = 0;
  #configFetchedFor: string | null = null;
  #histogramFn: HistogramFn;
  #histogramRequestId = 0;
  #loadFieldsFn: LoadFieldsFn;
  #fieldsRequestId = 0;
  #fieldsFetchedFor: string | null = null;

  constructor(opts: SearchStoreOptions) {
    this.indexes = opts.initialIndexes;
    this.#parsedQuery = opts.parsedQuery;
    this.#searchFn = opts.searchFn;
    this.#histogramFn = opts.histogramFn;
    this.#loadConfigFn = opts.loadConfig;
    this.#loadFieldsFn = opts.loadFields;
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

  /**
   * Installs the URL → search() $effect.
   * MUST be called inside component context (not from the constructor).
   */
  setupAutoSearch(): void {
    $effect(() => {
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

      this.#search();
      this.#fetchHistogram();
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

  async #search(): Promise<void> {
    if (this.selectedIndex === null) return;

    const requestId = ++this.#searchRequestId;
    this.loading = 'fresh';
    this.searchError = null;

    try {
      const result = await this.#searchFn({
        indexId: this.selectedIndex,
        query: this.query || '*',
        ...buildTimeParams(this.timeRange),
        sortDirection: this.sortDirection,
        limit: BATCH_SIZE,
        offset: 0
      });
      if (requestId !== this.#searchRequestId) return;
      this.rawHits = result.rawHits;
      this.numHits = result.numHits;
      this.hasSearched = true;
    } catch (e) {
      if (requestId !== this.#searchRequestId) return;
      this.searchError = e instanceof Error ? e.message : 'Search failed';
      this.rawHits = [];
      this.numHits = 0;
    } finally {
      if (requestId === this.#searchRequestId) this.loading = 'idle';
    }
  }

  async #fetchHistogram(): Promise<void> {
    if (this.selectedIndex === null) return;

    const requestId = ++this.#histogramRequestId;
    this.histogramLoading = true;
    this.histogramError = null;

    try {
      const result = await this.#histogramFn({
        indexId: this.selectedIndex,
        query: this.query || '*',
        ...buildTimeParams(this.timeRange)
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
      const cfg = await this.#loadConfigFn(indexId);
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
      const fields = await this.#loadFieldsFn(indexId, fieldConfig);
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
}

function buildTimeParams(
  range: TimeRange
): Pick<SearchInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'> {
  return range.type === 'relative'
    ? { timeRange: range.preset }
    : { startTimestamp: range.start, endTimestamp: range.end };
}
