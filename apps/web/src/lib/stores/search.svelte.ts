import { goto } from '$app/navigation';
import { page } from '$app/state';
import type {
  FieldConfig,
  HistogramBucket,
  HistogramFn,
  HistogramInput,
  IndexOption,
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

  constructor(opts: SearchStoreOptions) {
    this.indexes = opts.initialIndexes;
    this.#parsedQuery = opts.parsedQuery;
    this.#searchFn = opts.searchFn;
    this.#histogramFn = opts.histogramFn;
    this.#loadConfigFn = opts.loadConfig;
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
}

function buildTimeParams(
  range: TimeRange
): Pick<SearchInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'> {
  return range.type === 'relative'
    ? { timeRange: range.preset }
    : { startTimestamp: range.start, endTimestamp: range.end };
}
