import { goto } from '$app/navigation';
import { page } from '$app/state';
import { SvelteSet } from 'svelte/reactivity';
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
	ParsedQuery
} from '$lib/types';
import { composeQuery } from 'api/query';
import { searchLogs } from '$lib/api/log-search';
import { fetchHistogram } from '$lib/api/histogram';
import { loadFields } from '$lib/api/fields';
import { getIndexConfig } from '$lib/api/indexes';
import { getPreferences, setPreferences } from '$lib/api/preferences';
import { buildQueryUrl, serialize } from '$lib/utils/query-params';
import { foldRuns, groupConsecutiveHits, type LogListRow } from '$lib/utils/fold-hits';
import { normalizeHit } from '$lib/utils/normalize-hit';
import { readLastIndex, writeLastIndex, clearLastIndex } from '$lib/utils/last-index';
import { resolveWindow } from '$lib/utils/time-range';
import { UNKNOWN_LEVEL } from '$lib/constants/level-colors';
import {
	countFieldPaths,
	displayNameFor,
	serializeTimeRange,
	type FieldSample
} from '$lib/utils/fields';
import { RequestGuard } from '$lib/stores/request-guard';
import { isAbortError } from '$lib/api/errors';
import type { DisplayMode, Preferences } from 'api/types';

const BATCH_SIZE = 200;
const MAX_OFFSET = 10_000;

// Collapse rapid preference changes (toggles, drag-reorder) into a single PUT.
const PREF_SAVE_DEBOUNCE_MS = 300;

export interface SearchStoreOptions {
	/** Reactive accessor for the URL-derived query. Read inside $effect to subscribe. */
	parsedQuery: () => ParsedQuery;
	indexes: () => IndexOption[];
	/** Called after each successful fresh (non-append) search; silent prefetches do not trigger it. */
	onFreshSearch?: () => void;
}

export class SearchStore {
	rawHits = $state.raw<Record<string, unknown>[]>([]);
	numHits = $state<number | null>(null);
	elapsedTimeMicros = $state(0);
	loading = $state<'idle' | 'fresh'>('idle');
	#prefetching = $state(false);
	#lastBatchFull = $state(false);
	searchError = $state<string | null>(null);
	hasSearched = $state(false);
	#refreshRevision = $state(0);

	fieldConfig = $state<FieldConfig | null>(null);
	configError = $state<string | null>(null);

	histogramBuckets = $state.raw<HistogramBucket[]>([]);
	histogramLoading = $state(false);
	histogramError = $state<string | null>(null);

	#schemaFields = $state.raw<LogField[]>([]);
	#sample = $state.raw<FieldSample>({ counts: new Map(), total: 0 });

	/**
	 * How much of the current search's first page carries each field path. `_field_caps` answers per
	 * split and never sees the query, so this is the panel's only query-aware signal: it ranks the
	 * sections and gates which json leaves earn a row.
	 */
	get fieldSample(): FieldSample {
		return this.#sample;
	}

	// The json parents stay out of the list: `_field_caps` reports their leaves as entries of their
	// own. The hits fill the gap for a leaf too fresh to be in a published split.
	fields = $derived.by<LogField[]>(() => {
		const listed = this.#schemaFields.filter((f) => f.type !== 'json');
		const cfg = this.fieldConfig;
		if (cfg === null) return listed;
		const known = new Set([
			...this.#schemaFields.map((f) => f.name),
			cfg.timestampField,
			cfg.messageField,
			cfg.levelField
		]);
		// Leaves under a surviving json parent only: anything else the list omits is not a fast field.
		const jsonPrefixes = this.#schemaFields
			.filter((f) => f.type === 'json')
			.map((f) => `${f.name}.`);
		const extra: LogField[] = [];
		for (const name of this.#sample.counts.keys()) {
			if (known.has(name)) continue;
			if (!jsonPrefixes.some((p) => name.startsWith(p))) continue;
			extra.push({ name, displayName: displayNameFor(name, cfg.isOtel), type: 'text' });
		}
		return [...listed, ...extra];
	});
	fieldsLoading = $state(false);
	fieldsError = $state<string | null>(null);
	#fieldsLoadedFor = $state<string | null>(null);
	// The key match already implies a selected index and a loaded config: both are nulled with it.
	fieldsReady = $derived(
		!this.fieldsLoading &&
			this.#fieldsLoadedFor ===
				`${this.selectedIndex}|${serializeTimeRange(this.timeRange)}|${this.#refreshRevision}`
	);

	columnFields = $derived.by<LogField[]>(() => {
		const cfg = this.fieldConfig;
		if (!cfg) return this.fields;
		const msg = cfg.messageField;
		return [
			...this.fields,
			{ name: msg, displayName: displayNameFor(msg, cfg.isOtel), type: 'text' }
		];
	});

	// null = "using defaults"
	#savedFields = $state<string[] | null>(null);
	activeFields = $derived(this.#savedFields ?? this.#defaultDisplayFields());
	lineWrap = $state(false);
	displayMode = $state<DisplayMode>('table');

	#levelsRoster = $state<LevelBucket[]>([]);
	#levelsRosterKey: string | null = null;

	get levels(): LevelBucket[] {
		return this.#levelsRoster;
	}

	#normalized = new WeakMap<Record<string, unknown>, LogHit>();
	#normalizedFor: FieldConfig | null = null;

	logs: LogHit[] = $derived.by(() => {
		const fc = this.fieldConfig;
		if (!fc) return [];
		if (fc !== this.#normalizedFor) {
			this.#normalizedFor = fc;
			this.#normalized = new WeakMap();
		}
		return this.rawHits.map((raw, i) => {
			let hit = this.#normalized.get(raw);
			if (hit === undefined) {
				hit = normalizeHit(raw, i, fc);
				this.#normalized.set(raw, hit);
			}
			return hit;
		});
	});

	#expandedFolds = new SvelteSet<string>();
	#autoSearchSig: string | null = null;

	foldEnabled = $derived(page.url.searchParams.get('fold') === '1');

	// Keyed separately from expansion so toggling one fold doesn't re-key every hit.
	#runs = $derived(
		this.foldEnabled
			? groupConsecutiveHits(this.logs, this.activeFields, this.fieldConfig?.timestampField)
			: null
	);

	rows: LogListRow[] = $derived.by(() => {
		const runs = this.#runs;
		if (runs === null) return this.logs.map((hit) => ({ kind: 'hit' as const, hit }));
		return foldRuns(runs, this.#expandedFolds);
	});

	setFoldEnabled(next: boolean): void {
		const url = buildQueryUrl(page.url.searchParams, {}, next);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	toggleFold(id: string): void {
		if (this.#expandedFolds.has(id)) this.#expandedFolds.delete(id);
		else this.#expandedFolds.add(id);
	}

	#parsedQuery: () => ParsedQuery;
	#indexes: () => IndexOption[];
	#onFreshSearch?: () => void;
	#disposed = false;
	#searchAbort?: AbortController;
	#searchGuard = new RequestGuard();
	#snapshotStartTs: number | undefined = $state(undefined);
	#snapshotEndTs: number | undefined = $state(undefined);
	#configGuard = new RequestGuard();
	#configFetchedFor: string | null = null;
	#histogramAbort?: AbortController;
	#histogramGuard = new RequestGuard();
	#histogramFetchedFor: string | null = null;
	#fieldsAbort?: AbortController;
	#fieldsGuard = new RequestGuard();
	#fieldsFetchedFor: string | null = null;
	#activeFieldsGuard = new RequestGuard();
	#activeFieldsFetchedFor: string | null = null;
	#confirmedPrefs: Preferences = { displayFields: null, lineWrap: false, displayMode: 'table' };
	#prefSave: { timer: ReturnType<typeof setTimeout>; commit: () => void } | null = null;
	#prefSaveSeq = 0;

	constructor(opts: SearchStoreOptions) {
		this.#indexes = opts.indexes;
		this.#parsedQuery = opts.parsedQuery;
		this.#onFreshSearch = opts.onFreshSearch;
	}

	get indexes(): IndexOption[] {
		return this.#indexes();
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

	/** Invalidates search-data caches when Run refreshes an unchanged query. */
	get refreshRevision(): number {
		return this.#refreshRevision;
	}

	navigateQuery(partial: Partial<ParsedQuery>, opts?: { push?: boolean }): void {
		this.#searchAbort?.abort();
		this.#histogramAbort?.abort();
		// Re-search even when the URL is unchanged; only the fold toggle skips it.
		this.#autoSearchSig = null;
		const url = buildQueryUrl(page.url.searchParams, partial);
		goto(url, { replaceState: !opts?.push, keepFocus: true, noScroll: true });
	}

	runQuery(query: string): void {
		if (this.#disposed || this.selectedIndex === null) return;
		if (query === this.query) {
			this.#refreshRevision += 1;
			this.#runFreshSearch(true);
			return;
		}
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

		// UNKNOWN is display-only, so it never counts toward "every level is selected".
		const known = this.#levelsRoster.map((l) => l.name).filter((n) => n !== UNKNOWN_LEVEL);
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
		this.numHits = null;
		this.elapsedTimeMicros = 0;
		this.rawHits = [];
		// Counts belong to the index that produced them; kept, they would rank the next index's fields.
		this.#countPaths([]);
		this.#lastBatchFull = false;
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
			return () => this.dispose();
		});

		$effect(() => {
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

			const searchSig = `${active}|${serialize(this.#parsedQuery()).toString()}`;
			if (searchSig !== this.#autoSearchSig) {
				this.#autoSearchSig = searchSig;
				this.#runFreshSearch();
			}

			writeLastIndex(active);
		});

		// Keyed by the serialized range, never by resolved seconds — a relative preset resolves to a
		// new `now` on every read and would never settle.
		$effect(() => {
			const active = this.selectedIndex;
			const cfg = this.fieldConfig;
			if (active === null || cfg === null) return;

			const key = `${active}|${cfg.isOtel ? '1' : '0'}|${cfg.timestampField}|${cfg.messageField}|${serializeTimeRange(this.timeRange)}|${this.#refreshRevision}`;
			if (key === this.#fieldsFetchedFor) return;
			this.#fieldsFetchedFor = key;
			this.#loadFields(active, cfg);
		});
	}

	#runFreshSearch(forceHistogram = false): void {
		const timeWindow = resolveWindow(this.timeRange);
		void this.#runSearch(false, timeWindow);
		void this.#fetchHistogram(timeWindow, forceHistogram);
	}

	async #runSearch(
		append: boolean,
		timeWindow?: { startTs: number; endTs: number }
	): Promise<void> {
		if (this.#disposed) return;
		if (this.selectedIndex === null) return;

		this.#searchAbort?.abort();
		const controller = new AbortController();
		this.#searchAbort = controller;
		const requestId = this.#searchGuard.next();

		// Appending happens ahead of the viewport, so it stays silent.
		if (append) {
			this.#prefetching = true;
		} else {
			this.loading = 'fresh';
			this.searchError = null;
		}

		try {
			let startTs: number | undefined;
			let endTs: number | undefined;

			if (append) {
				startTs = this.#snapshotStartTs;
				endTs = this.#snapshotEndTs;
			} else {
				const resolved = timeWindow ?? resolveWindow(this.timeRange);
				startTs = resolved.startTs;
				endTs = resolved.endTs;
				this.#snapshotStartTs = startTs;
				this.#snapshotEndTs = endTs;
			}

			const result = await searchLogs(
				{
					indexId: this.selectedIndex,
					query: this.composedQuery,
					startTs,
					endTs,
					sortDirection: this.sortDirection,
					limit: BATCH_SIZE,
					offset: append ? this.rawHits.length : 0
				},
				controller.signal
			);

			if (!this.#searchGuard.isCurrent(requestId)) return;

			if (append) {
				this.rawHits = [...this.rawHits, ...result.rawHits];
			} else {
				this.rawHits = result.rawHits;
				this.#expandedFolds.clear();
				this.hasSearched = true;
				this.#onFreshSearch?.();
			}
			this.#lastBatchFull = result.rawHits.length === BATCH_SIZE;
			if (!append) {
				this.elapsedTimeMicros = result.elapsedTimeMicros;
			}

			if (!append) this.#countPaths(result.rawHits);
		} catch (e) {
			if (isAbortError(e)) return;
			if (!this.#searchGuard.isCurrent(requestId)) return;
			if (append) return;
			this.searchError = e instanceof Error ? e.message : 'Search failed';
			this.rawHits = [];
			this.#countPaths([]);
			this.elapsedTimeMicros = 0;
			this.#lastBatchFull = false;
		} finally {
			if (this.#searchGuard.isCurrent(requestId)) {
				this.#prefetching = false;
				if (!append) this.loading = 'idle';
			}
		}
	}

	#canFetchMore(): boolean {
		return (
			this.loading === 'idle' &&
			!this.#prefetching &&
			this.#lastBatchFull &&
			this.rawHits.length < MAX_OFFSET &&
			(this.numHits === null || this.rawHits.length < this.numHits)
		);
	}

	maybeLoadMore(): void {
		if (!this.#canFetchMore()) return;
		void this.#runSearch(true);
	}

	get loadingMore(): boolean {
		return this.#prefetching;
	}

	get listEnd(): 'more' | 'end' | 'capped' {
		if (this.numHits !== null && this.rawHits.length >= this.numHits) return 'end';
		if (this.rawHits.length >= MAX_OFFSET) return 'capped';
		return this.#lastBatchFull ? 'more' : 'end';
	}

	async #fetchHistogram(
		timeWindow: { startTs: number; endTs: number },
		force = false
	): Promise<void> {
		if (this.#disposed) return;
		if (this.selectedIndex === null) return;

		const fetchKey = `${this.selectedIndex}|${this.composedQuery}|${timeWindow.startTs}|${timeWindow.endTs}`;
		if (!force && fetchKey === this.#histogramFetchedFor) {
			this.#histogramAbort?.abort();
			return;
		}

		// Counts are cleared below; only a completed request can be reused after that.
		this.#histogramFetchedFor = null;
		this.#histogramAbort?.abort();
		const controller = new AbortController();
		this.#histogramAbort = controller;
		const requestId = this.#histogramGuard.next();
		this.histogramLoading = true;
		this.histogramError = null;
		this.numHits = null;

		try {
			const result = await fetchHistogram(
				{
					indexId: this.selectedIndex,
					query: this.composedQuery,
					...timeWindow
				} satisfies HistogramInput,
				controller.signal
			);
			if (!this.#histogramGuard.isCurrent(requestId)) return;
			this.histogramBuckets = result.buckets;
			this.numHits = result.totalDocCount;
			this.#histogramFetchedFor = fetchKey;

			const newKey = `${this.selectedIndex}|${this.query}|${serializeTimeRange(this.timeRange)}`;
			const fresh = this.#computeLevelTotals(result.buckets);
			if (newKey !== this.#levelsRosterKey) {
				this.#levelsRosterKey = newKey;
				this.#levelsRoster = fresh;
			} else {
				this.#levelsRoster = this.#mergeLevels(this.#levelsRoster, fresh);
			}
		} catch (e) {
			if (isAbortError(e)) return;
			if (!this.#histogramGuard.isCurrent(requestId)) return;
			this.#histogramFetchedFor = null;
			this.histogramError = e instanceof Error ? e.message : 'Histogram fetch failed';
			this.histogramBuckets = [];
			this.numHits = null;
		} finally {
			if (this.#histogramGuard.isCurrent(requestId)) this.histogramLoading = false;
		}
	}

	async #loadConfig(indexId: string): Promise<void> {
		const requestId = this.#configGuard.next();
		this.fieldConfig = null;
		this.#fieldsFetchedFor = null;
		this.#fieldsLoadedFor = null;
		this.#fieldsAbort?.abort();
		this.#fieldsGuard.next();
		this.fieldsLoading = false;
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

	/** One fixed slice — the first page. Accumulating across scroll pages would reorder the panel. */
	#countPaths(hits: Record<string, unknown>[]): void {
		try {
			this.#sample = countFieldPaths(hits);
		} catch (e) {
			console.warn('[search] field-path sampling failed', e);
		}
	}

	async #loadFields(indexId: string, fieldConfig: FieldConfig): Promise<void> {
		if (this.#disposed) return;
		this.#fieldsAbort?.abort();
		const controller = new AbortController();
		this.#fieldsAbort = controller;
		const requestId = this.#fieldsGuard.next();
		const loadedFor = `${indexId}|${serializeTimeRange(this.timeRange)}|${this.#refreshRevision}`;
		this.fieldsLoading = true;
		this.fieldsError = null;
		try {
			const fields = await loadFields(
				indexId,
				fieldConfig,
				resolveWindow(this.timeRange),
				controller.signal
			);
			if (controller.signal.aborted || !this.#fieldsGuard.isCurrent(requestId)) return;
			this.#schemaFields = fields;
			this.#fieldsLoadedFor = loadedFor;
		} catch (e) {
			if (isAbortError(e)) return;
			if (!this.#fieldsGuard.isCurrent(requestId)) return;
			this.fieldsError = e instanceof Error ? e.message : 'Failed to load fields';
			this.#schemaFields = [];
			this.#fieldsLoadedFor = null;
		} finally {
			if (this.#fieldsGuard.isCurrent(requestId)) this.fieldsLoading = false;
		}
	}

	async #loadActiveFields(indexId: string): Promise<void> {
		const requestId = this.#activeFieldsGuard.next();
		const saveSeqAtStart = this.#prefSaveSeq;
		let prefs: Preferences;
		try {
			prefs = await getPreferences(indexId);
		} catch (e) {
			if (this.#disposed) return;
			if (!this.#activeFieldsGuard.isCurrent(requestId)) return;
			// Reset cache key so the effect retries on the next reactive run.
			this.#activeFieldsFetchedFor = null;
			prefs = { displayFields: null, lineWrap: false, displayMode: 'table' };
			toast.error(e instanceof Error ? e.message : 'Failed to load display preferences');
		}
		if (this.#disposed || !this.#activeFieldsGuard.isCurrent(requestId)) return;
		this.#confirmedPrefs = prefs;
		// Local edits win, but retain the server value for rollback if their save fails.
		if (this.#prefSaveSeq !== saveSeqAtStart) return;
		this.#savedFields = prefs.displayFields;
		this.lineWrap = prefs.lineWrap;
		this.displayMode = prefs.displayMode;
	}

	setActiveFields(next: string[]): void {
		this.#savedFields = next;
		// Fold ids are positional, so a column change regroups runs and invalidates them.
		this.#expandedFolds.clear();
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
		const snapshot: Preferences = {
			displayFields: this.#savedFields,
			lineWrap: this.lineWrap,
			displayMode: this.displayMode
		};
		const commit = () => {
			this.#prefSave = null;
			setPreferences(indexId, snapshot)
				.then((saved) => {
					if (this.selectedIndex !== indexId || seq !== this.#prefSaveSeq) return;
					this.#confirmedPrefs = saved;
				})
				.catch((e) => {
					if (this.#disposed) return;
					// Superseded by a newer change (or index switch) — let that one win.
					if (this.selectedIndex !== indexId || seq !== this.#prefSaveSeq) return;
					this.#savedFields = this.#confirmedPrefs.displayFields;
					this.lineWrap = this.#confirmedPrefs.lineWrap;
					this.displayMode = this.#confirmedPrefs.displayMode;
					toast.error(e instanceof Error ? e.message : 'Failed to save display preferences');
				});
		};
		if (this.#prefSave !== null) clearTimeout(this.#prefSave.timer);
		this.#prefSave = { timer: setTimeout(commit, PREF_SAVE_DEBOUNCE_MS), commit };
	}

	#defaultDisplayFields(): string[] {
		const messageField = this.fieldConfig?.messageField;
		return messageField ? [messageField] : [];
	}

	/** Aborts in-flight work and flushes any pending preference save. Installed as the
	 *  destroy cleanup by setupAutoSearch; idempotent. */
	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
		this.#searchAbort?.abort();
		this.#histogramAbort?.abort();
		this.#fieldsAbort?.abort();
		const pending = this.#prefSave;
		if (pending !== null) {
			clearTimeout(pending.timer);
			pending.commit();
		}
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
