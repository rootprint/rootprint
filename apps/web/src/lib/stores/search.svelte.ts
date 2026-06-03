import { goto } from '$app/navigation';
import { page } from '$app/state';
import { toast } from 'svelte-sonner';
import type {
	FieldConfig,
	Filter,
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
import { composeQuery } from 'api/query';
import { searchLogs } from '$lib/api/log-search';
import { fetchHistogram } from '$lib/api/histogram';
import { loadFields } from '$lib/api/fields';
import { getIndexConfig } from '$lib/api/indexes';
import { getPreferences, setPreferences } from '$lib/api/preferences';
import { buildQueryUrl } from '$lib/utils/query-params';
import { normalizeHit } from '$lib/utils/normalize-hit';
import { readLastIndex, writeLastIndex, clearLastIndex } from '$lib/utils/last-index';
import { resolveTimeRange } from '$lib/utils/time-range';
import { displayNameFor, extractJsonSubFields, serializeTimeRange } from '$lib/utils/fields';
import { RequestGuard } from '$lib/stores/request-guard';
import type { DisplayMode, Preferences } from 'api/types';

const BATCH_SIZE = 200;

// Collapse rapid preference changes (toggles, drag-reorder) into a single PUT.
const PREF_SAVE_DEBOUNCE_MS = 300;

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
	elapsedTimeMicros = $state(0);
	loading = $state<'idle' | 'fresh' | 'appending'>('idle');
	#prefetching = $state(false);
	searchError = $state<string | null>(null);
	hasSearched = $state(false);

	fieldConfig = $state<FieldConfig | null>(null);
	configError = $state<string | null>(null);

	histogramBuckets = $state<HistogramBucket[]>([]);
	histogramLoading = $state(false);
	histogramError = $state<string | null>(null);

	#schemaFields = $state<LogField[]>([]);
	#discoveredPaths = $state<Set<string>>(new Set());

	fields = $derived.by<LogField[]>(() => {
		const cfg = this.fieldConfig;
		const jsonNames = new Set(
			this.#schemaFields.filter((f) => f.type === 'json').map((f) => f.name)
		);
		const hiddenPaths = new Set<string>(
			cfg ? [cfg.timestampField, cfg.messageField, cfg.levelField] : []
		);
		const isOtel = cfg?.isOtel ?? false;
		const out: LogField[] = [];
		for (const f of this.#schemaFields) {
			if (jsonNames.has(f.name)) continue;
			out.push(f);
		}
		for (const path of this.#discoveredPaths) {
			if (hiddenPaths.has(path)) continue;
			out.push({
				name: path,
				displayName: displayNameFor(path, isOtel),
				type: 'text'
			});
		}
		return out;
	});
	fieldsLoading = $state(false);
	fieldsError = $state<string | null>(null);

	activeFields = $state<string[]>([]);
	lineWrap = $state(false);
	displayMode = $state<DisplayMode>('table');

	#levelsRoster = $state<LevelBucket[]>([]);
	#levelsRosterKey: string | null = null;

	get levels(): LevelBucket[] {
		return this.#levelsRoster;
	}

	logs: LogHit[] = $derived.by(() => {
		const fc = this.fieldConfig;
		if (!fc) return [];
		return this.rawHits.map((raw, i) => normalizeHit(raw, i, fc));
	});

	#parsedQuery: () => ParsedQuery;
	#onFreshSearch?: () => void;
	#searchAbort?: AbortController;
	#searchGuard = new RequestGuard();
	#snapshotStartTs: number | undefined = $state(undefined);
	#snapshotEndTs: number | undefined = $state(undefined);
	#configGuard = new RequestGuard();
	#configFetchedFor: string | null = null;
	#histogramAbort?: AbortController;
	#histogramGuard = new RequestGuard();
	#fieldsGuard = new RequestGuard();
	#fieldsFetchedFor: string | null = null;
	#activeFieldsGuard = new RequestGuard();
	#activeFieldsFetchedFor: string | null = null;
	#confirmedPrefs: Preferences = { displayFields: null, lineWrap: false, displayMode: 'table' };
	#prefSaveTimer: ReturnType<typeof setTimeout> | null = null;
	#prefSaveSeq = 0;

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

	get filters(): Filter[] {
		return this.#parsedQuery().filters;
	}

	/** The active query string composed with filters. */
	get composedQuery(): string {
		return composeQuery(this.query, this.filters);
	}

	/** Absolute start of the in-flight search window, in seconds-since-epoch. `undefined` before the first search. */
	get resolvedStartTs(): number | undefined {
		return this.#snapshotStartTs;
	}

	/** Absolute end of the in-flight search window, in seconds-since-epoch. `undefined` before the first search. */
	get resolvedEndTs(): number | undefined {
		return this.#snapshotEndTs;
	}

	navigateQuery(partial: Partial<ParsedQuery>, opts?: { push?: boolean }): void {
		this.#searchAbort?.abort();
		this.#histogramAbort?.abort();
		const url = buildQueryUrl(page.url.searchParams, partial);
		goto(url, { replaceState: !opts?.push, keepFocus: true, noScroll: true });
	}

	runQuery(query: string): void {
		this.navigateQuery({ query }, { push: true });
	}

	hasFilter(field: string, value: string, exclude = false): boolean {
		return this.filters.some(
			(f) => f.field === field && f.value === value && f.exclude === exclude
		);
	}

	addFilter(field: string, value: string, exclude = false): void {
		const current = this.filters;
		if (current.some((f) => f.field === field && f.value === value && f.exclude === exclude)) {
			return;
		}
		// Flip not stack: strip the opposite-sign entry for the same field/value
		// so include and exclude on one value can never coexist.
		const stripped = current.filter(
			(f) => !(f.field === field && f.value === value && f.exclude === !exclude)
		);
		const next = [...stripped, { field, value, exclude }];
		this.navigateQuery({ filters: next });
	}

	removeFilter(field: string, value: string, exclude = false): void {
		const next = this.filters.filter(
			(f) => !(f.field === field && f.value === value && f.exclude === exclude)
		);
		if (next.length === this.filters.length) return;
		this.navigateQuery({ filters: next });
	}

	clearFilters(): void {
		if (this.filters.length === 0) return;
		this.navigateQuery({ filters: [] });
	}

	toggleLevelFilter(value: string): void {
		const levelField = this.fieldConfig?.levelField;
		if (!levelField) return;

		if (this.hasFilter(levelField, value, false)) {
			this.removeFilter(levelField, value, false);
			return;
		}

		const known = this.#levelsRoster.map((l) => l.name);
		if (known.length >= 2 && this.#wouldSelectAllLevels(known, levelField, value)) {
			this.#clearLevelFilters(levelField);
			return;
		}

		this.addFilter(levelField, value, false);
	}

	#wouldSelectAllLevels(known: string[], levelField: string, newValue: string): boolean {
		const positive = new Set<string>();
		for (const f of this.filters) {
			if (f.field !== levelField) continue;
			if (f.exclude) return false;
			positive.add(f.value);
		}
		if (positive.has(newValue)) return false;
		for (const v of known) {
			if (v !== newValue && !positive.has(v)) return false;
		}
		const allowed = new Set([...known, newValue]);
		for (const v of positive) {
			if (!allowed.has(v)) return false;
		}
		return true;
	}

	#clearLevelFilters(levelField: string): void {
		const next = this.filters.filter((f) => !(f.field === levelField && !f.exclude));
		if (next.length === this.filters.length) return;
		this.navigateQuery({ filters: next });
	}

	handleIndexChange(indexId: string): void {
		this.numHits = 0;
		this.elapsedTimeMicros = 0;
		this.rawHits = [];
		this.#snapshotStartTs = undefined;
		this.#snapshotEndTs = undefined;
		this.searchError = null;
		this.navigateQuery({ index: indexId, query: '', filters: [] }, { push: true });
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

		this.#searchAbort?.abort();
		const controller = new AbortController();
		this.#searchAbort = controller;
		const requestId = this.#searchGuard.next();

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
					endTimestamp: this.timeRange.type === 'absolute' ? this.timeRange.end : undefined
				});
				startTs = resolved.startTs;
				endTs = resolved.endTs;
				this.#snapshotStartTs = startTs;
				this.#snapshotEndTs = endTs;
			}

			const result = await searchLogs(
				{
					indexId: this.selectedIndex,
					query: this.composedQuery,
					startTimestamp: startTs,
					endTimestamp: endTs,
					sortDirection: this.sortDirection,
					limit: BATCH_SIZE,
					offset: append ? this.rawHits.length : 0
				},
				{ countAll: mode === 'fresh', signal: controller.signal }
			);

			if (!this.#searchGuard.isCurrent(requestId)) return;

			if (append) {
				this.rawHits = [...this.rawHits, ...result.rawHits];
			} else {
				this.rawHits = result.rawHits;
				this.hasSearched = true;
				this.#onFreshSearch?.();
			}
			if (mode === 'fresh') {
				this.numHits = result.numHits;
				this.elapsedTimeMicros = result.elapsedTimeMicros;
			}

			this.#discoverFields(result.rawHits, { reset: !append });

			success = true;
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			if (!this.#searchGuard.isCurrent(requestId)) return;
			if (silent) return;
			this.searchError = e instanceof Error ? e.message : 'Search failed';
			if (mode === 'fresh') {
				this.rawHits = [];
				this.numHits = 0;
				this.elapsedTimeMicros = 0;
			}
		} finally {
			if (this.#searchGuard.isCurrent(requestId)) {
				this.#prefetching = false;
				if (!silent) this.loading = 'idle';
			}
		}

		if (success && mode === 'fresh') {
			queueMicrotask(() => {
				if (!this.#searchGuard.isCurrent(requestId)) return;
				if (this.#canFetchMore()) {
					void this.#runSearch('prefetch');
				}
			});
		}
	}

	#canFetchMore(): boolean {
		return this.loading === 'idle' && !this.#prefetching && this.rawHits.length < this.numHits;
	}

	maybeLoadMore(): void {
		if (!this.#canFetchMore()) return;
		void this.#runSearch('prefetch');
	}

	async #fetchHistogram(): Promise<void> {
		if (this.selectedIndex === null) return;

		this.#histogramAbort?.abort();
		const controller = new AbortController();
		this.#histogramAbort = controller;
		const requestId = this.#histogramGuard.next();
		this.histogramLoading = true;
		this.histogramError = null;

		try {
			const result = await fetchHistogram(
				{
					indexId: this.selectedIndex,
					query: this.composedQuery,
					...buildTimeParams(this.timeRange)
				} satisfies HistogramInput,
				controller.signal
			);
			if (!this.#histogramGuard.isCurrent(requestId)) return;
			this.histogramBuckets = result.buckets;

			const newKey = `${this.selectedIndex}|${this.query}|${serializeTimeRange(this.timeRange)}`;
			const fresh = this.#computeLevelTotals(result.buckets);
			if (newKey !== this.#levelsRosterKey) {
				this.#levelsRosterKey = newKey;
				this.#levelsRoster = fresh;
			} else {
				this.#levelsRoster = this.#mergeLevels(this.#levelsRoster, fresh);
			}
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			if (!this.#histogramGuard.isCurrent(requestId)) return;
			this.histogramError = e instanceof Error ? e.message : 'Histogram fetch failed';
			this.histogramBuckets = [];
		} finally {
			if (this.#histogramGuard.isCurrent(requestId)) this.histogramLoading = false;
		}
	}

	async #loadConfig(indexId: string): Promise<void> {
		const requestId = this.#configGuard.next();
		this.fieldConfig = null;
		this.#fieldsFetchedFor = null;
		this.configError = null;
		try {
			const cfg = await getIndexConfig(indexId);
			if (!this.#configGuard.isCurrent(requestId)) return;
			this.fieldConfig = cfg;
		} catch (e) {
			if (!this.#configGuard.isCurrent(requestId)) return;
			this.configError = e instanceof Error ? e.message : 'Failed to load index config';
		}
	}

	/** Re-runs field discovery for the current index; resets the cache key so the fields-load effect refires. */
	reloadFields(): void {
		const cfg = this.fieldConfig;
		const indexId = this.selectedIndex;
		if (!cfg || !indexId) return;
		this.#fieldsFetchedFor = null;
		this.#loadFields(indexId, cfg);
	}

	#discoverFields(hits: Record<string, unknown>[], opts: { reset: boolean }): void {
		const jsonNames = this.#schemaFields.filter((f) => f.type === 'json').map((f) => f.name);
		if (jsonNames.length === 0) {
			if (opts.reset) this.#discoveredPaths = new Set();
			return;
		}
		try {
			const found = extractJsonSubFields(hits, jsonNames);
			if (opts.reset) {
				this.#discoveredPaths = found;
			} else {
				const next = new Set(this.#discoveredPaths);
				for (const p of found) next.add(p);
				this.#discoveredPaths = next;
			}
		} catch (e) {
			console.warn('[search] JSON sub-field discovery failed', e);
		}
	}

	async #loadFields(indexId: string, fieldConfig: FieldConfig): Promise<void> {
		const requestId = this.#fieldsGuard.next();
		this.fieldsLoading = true;
		this.fieldsError = null;
		this.#discoveredPaths = new Set();
		try {
			const fields = await loadFields(indexId, fieldConfig);
			if (!this.#fieldsGuard.isCurrent(requestId)) return;
			this.#schemaFields = fields;
			this.#discoverFields(this.rawHits, { reset: true });
		} catch (e) {
			if (!this.#fieldsGuard.isCurrent(requestId)) return;
			this.fieldsError = e instanceof Error ? e.message : 'Failed to load fields';
			this.#schemaFields = [];
		} finally {
			if (this.#fieldsGuard.isCurrent(requestId)) this.fieldsLoading = false;
		}
	}

	async #loadActiveFields(indexId: string): Promise<void> {
		const requestId = this.#activeFieldsGuard.next();
		try {
			const prefs = await getPreferences(indexId);
			if (!this.#activeFieldsGuard.isCurrent(requestId)) return;
			this.#confirmedPrefs = prefs;
			this.activeFields = prefs.displayFields ?? [];
			this.lineWrap = prefs.lineWrap;
			this.displayMode = prefs.displayMode;
		} catch (e) {
			if (!this.#activeFieldsGuard.isCurrent(requestId)) return;
			// Reset cache key so the effect retries on the next reactive run.
			this.#activeFieldsFetchedFor = null;
			this.#confirmedPrefs = { displayFields: null, lineWrap: false, displayMode: 'table' };
			this.activeFields = [];
			this.lineWrap = false;
			this.displayMode = 'table';
			toast.error(e instanceof Error ? e.message : 'Failed to load display preferences');
		}
	}

	setActiveFields(next: string[]): void {
		this.activeFields = next;
		this.#savePrefs();
	}

	setLineWrap(next: boolean): void {
		this.lineWrap = next;
		this.#savePrefs();
	}

	setDisplayMode(next: DisplayMode): void {
		this.displayMode = next;
		this.#savePrefs();
	}

	#savePrefs(): void {
		const indexId = this.selectedIndex;
		if (indexId === null) return;
		const seq = ++this.#prefSaveSeq;
		if (this.#prefSaveTimer !== null) clearTimeout(this.#prefSaveTimer);
		this.#prefSaveTimer = setTimeout(() => {
			this.#prefSaveTimer = null;
			if (this.selectedIndex !== indexId) return;
			const snapshot: Preferences = {
				displayFields: this.activeFields,
				lineWrap: this.lineWrap,
				displayMode: this.displayMode
			};
			setPreferences(indexId, snapshot)
				.then((saved) => {
					if (this.selectedIndex !== indexId || seq !== this.#prefSaveSeq) return;
					this.#confirmedPrefs = saved;
				})
				.catch((e) => {
					// Superseded by a newer change (or index switch) — let that one win.
					if (this.selectedIndex !== indexId || seq !== this.#prefSaveSeq) return;
					this.activeFields = this.#confirmedPrefs.displayFields ?? [];
					this.lineWrap = this.#confirmedPrefs.lineWrap;
					this.displayMode = this.#confirmedPrefs.displayMode;
					toast.error(e instanceof Error ? e.message : 'Failed to save display preferences');
				});
		}, PREF_SAVE_DEBOUNCE_MS);
	}

	#computeLevelTotals(buckets: HistogramBucket[]): LevelBucket[] {
		const totals: Record<string, number> = {};
		for (const b of buckets) {
			for (const [name, count] of Object.entries(b.levels)) {
				totals[name] = (totals[name] ?? 0) + count;
			}
		}
		return Object.entries(totals).map(([name, count]) => ({ name, count }));
	}

	#mergeLevels(prev: LevelBucket[], fresh: LevelBucket[]): LevelBucket[] {
		const freshByName = new Map(fresh.map((l) => [l.name, l.count]));
		const merged: LevelBucket[] = [];
		const seen = new Set<string>();
		for (const p of prev) {
			const c = freshByName.get(p.name);
			merged.push({ name: p.name, count: c ?? null });
			seen.add(p.name);
		}
		for (const f of fresh) {
			if (seen.has(f.name)) continue;
			merged.push(f);
		}
		return merged;
	}
}

function buildTimeParams(
	range: TimeRange
): Pick<SearchInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'> {
	return range.type === 'relative'
		? { timeRange: range.preset }
		: { startTimestamp: range.start, endTimestamp: range.end };
}
