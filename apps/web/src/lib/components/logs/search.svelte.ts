import { goto } from '$app/navigation';
import { page } from '$app/state';
import { untrack } from 'svelte';
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
	ParsedQuery,
	SearchInput
} from '#lib/types.js';
import { composeQuery } from 'api/query';
import { searchLogs } from '#lib/api/log-search.js';
import { fetchHistogram } from '#lib/api/histogram.js';
import { loadFields } from '#lib/api/fields.js';
import { getIndexConfig } from '#lib/api/indexes.js';
import { getPreferences, setPreferences } from '#lib/api/preferences.js';
import { buildQueryUrl } from '#lib/utils/query-params.js';
import { foldRuns, groupConsecutiveHits, type LogListRow } from '#lib/components/logs/fold-hits.js';
import { normalizeHit } from '#lib/components/logs/normalize-hit.js';
import { readLastIndex, writeLastIndex, clearLastIndex } from '#lib/utils/last-index.js';
import { resolveWindow } from '#lib/utils/time-range.js';
import { UNKNOWN_LEVEL } from '#lib/constants/level-colors.js';
import {
	countFieldPaths,
	displayNameFor,
	serializeTimeRange,
	type FieldSample
} from '#lib/utils/fields.js';
import type { DisplayMode, Preferences } from 'api/types';

const BATCH_SIZE = 200;
const MAX_OFFSET = 10_000;

// Collapse rapid preference changes (toggles, drag-reorder) into a single PUT.
const PREF_SAVE_DEBOUNCE_MS = 300;
const DEFAULT_PREFS: Preferences = { displayFields: null, lineWrap: false, displayMode: 'table' };

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
	loadingMore = $state(false);
	#lastBatchFull = $state(false);
	searchError = $state<string | null>(null);
	hasSearched = $state(false);
	/** Invalidates search-data caches when the view already shown is asked for again (Run, a re-picked range). */
	refreshRevision = $state(0);
	/** Absolute start of the in-flight search window, in seconds-since-epoch. `undefined` before the first search. */
	get resolvedStartTs(): number | undefined {
		return this.#input?.startTs;
	}
	/** Absolute end of the in-flight search window, in seconds-since-epoch. `undefined` before the first search. */
	get resolvedEndTs(): number | undefined {
		return this.#input?.endTs;
	}

	fieldConfig = $state<FieldConfig | null>(null);
	configError = $state<string | null>(null);

	histogramBuckets = $state.raw<HistogramBucket[]>([]);
	histogramIntervalSec = $state<number | undefined>();
	histogramLoading = $state(false);
	histogramError = $state<string | null>(null);

	#schemaFields = $state.raw<LogField[]>([]);

	/**
	 * How much of the current search's first page carries each field path. `_field_caps` answers per
	 * split and never sees the query, so this is the panel's only query-aware signal: it ranks the
	 * sections and gates which json leaves earn a row.
	 */
	fieldSample = $state.raw<FieldSample>({ counts: new Map(), total: 0 });

	// The json parents stay out of the list: `_field_caps` reports their leaves as entries of their
	// own. The hits fill the gap for a leaf too fresh to be in a published split.
	fields = $derived.by(() => {
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
		for (const name of this.fieldSample.counts.keys()) {
			if (known.has(name)) continue;
			if (!jsonPrefixes.some((p) => name.startsWith(p))) continue;
			extra.push({ name, displayName: displayNameFor(name, cfg.isOtel), type: 'text' });
		}
		return [...listed, ...extra];
	});
	fieldsLoading = $state(false);
	fieldsError = $state<string | null>(null);
	#fieldsLoadedFor = $state<string | null>(null);
	#fieldsReload = $state(0);

	columnFields = $derived.by(() => {
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

	levels = $state<LevelBucket[]>([]);
	#levelsRosterKey: string | null = null;

	#normalized = new WeakMap<Record<string, unknown>, LogHit>();
	#normalizedFor: FieldConfig | null = null;

	logs = $derived.by(() => {
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

	foldEnabled = $derived(page.url.searchParams.get('fold') === '1');

	// Keyed separately from expansion so toggling one fold doesn't re-key every hit.
	#runs = $derived(
		this.foldEnabled
			? groupConsecutiveHits(this.logs, this.activeFields, this.fieldConfig?.timestampField)
			: null
	);

	rows: LogListRow[] = $derived.by(() => {
		const runs = this.#runs;
		if (runs === null) return this.logs.map((hit) => ({ kind: 'hit', hit }));
		return foldRuns(runs, this.#expandedFolds);
	});

	setFoldEnabled(next: boolean): void {
		const url = buildQueryUrl(page.url.searchParams, {}, next);
		goto(url, { replace: true, reset: false });
	}

	toggleFold(id: string): void {
		if (this.#expandedFolds.has(id)) this.#expandedFolds.delete(id);
		else this.#expandedFolds.add(id);
	}

	#parsedQuery: () => ParsedQuery;
	#indexes: () => IndexOption[];
	#onFreshSearch?: () => void;
	#disposed = false;
	// The fresh search a load-more page extends; aborted when the next one starts.
	#searchRun?: { signal: AbortSignal; request: SearchInput };
	#confirmedPrefs = DEFAULT_PREFS;
	#prefSave: { timer: ReturnType<typeof setTimeout>; commit: () => void } | null = null;
	#prefSaveSeq = 0;

	// Request effects read these, never the parsed URL: a derived that recomputes to an equal value
	// doesn't rerun its dependents, so a request refetches only when one of its own inputs changes.
	// Null until the URL names the active index, so nothing loads for a fallback the redirect replaces.
	#index = $derived.by(() => {
		const active = this.selectedIndex;
		return this.#parsedQuery().index === active ? active : null;
	});
	#composedQuery = $derived(this.composedQuery);
	#rangeKey = $derived(serializeTimeRange(this.timeRange));
	#sort = $derived(this.sortDirection);
	#fieldsKey = $derived(`${this.#index}|${this.#rangeKey}|${this.refreshRevision}`);
	// The key match already implies a selected index and a loaded config: both are nulled with it.
	fieldsReady = $derived(!this.fieldsLoading && this.#fieldsLoadedFor === this.#fieldsKey);

	// Sort is left out: toggling it re-reads the window already on screen.
	#input = $derived.by<HistogramInput | null>(() => {
		const indexId = this.#index;
		const query = this.#composedQuery;
		void this.#rangeKey;
		void this.refreshRevision;
		if (indexId === null) return null;
		return { indexId, query, ...untrack(() => resolveWindow(this.timeRange)) };
	});

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

	/** Navigates to the merged query; asking for the view already shown refreshes it instead. */
	navigateQuery(partial: Partial<ParsedQuery>, opts?: { push?: boolean }): void {
		const url = buildQueryUrl(page.url.searchParams, partial);
		// Both sides canonical, so a hand-edited URL spelling out defaults still counts as unchanged.
		if (url === buildQueryUrl(page.url.searchParams, {})) {
			this.refreshRevision += 1;
			return;
		}
		goto(url, { replace: !opts?.push, reset: false });
	}

	runQuery(query: string): void {
		if (this.selectedIndex === null) return;
		// Equivalent text changes the URL without invalidating the request inputs.
		if (query !== this.query && composeQuery(query, this.filters) === this.composedQuery) {
			this.refreshRevision += 1;
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
		const known = this.levels.map((l) => l.name).filter((n) => n !== UNKNOWN_LEVEL);
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
	 * Installs the index redirect and one request effect per resource; each effect's teardown
	 * cancels its request, so a rerun or leaving the page supersedes it.
	 * MUST be called inside component context (not from the constructor).
	 */
	setupAutoSearch(): void {
		$effect(() => {
			return () => this.dispose();
		});

		// Puts the remembered or first index into the URL; requests wait for it through `#index`.
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
			if (urlIndex !== active) this.navigateQuery({ index: active });
			else writeLastIndex(active);
		});

		$effect(() => {
			const input = this.#input;
			const sortDirection = this.#sort;
			if (input === null) {
				this.loading = 'idle';
				this.loadingMore = false;
				return;
			}
			const controller = new AbortController();
			const request: SearchInput = { ...input, sortDirection, limit: BATCH_SIZE, offset: 0 };
			this.#searchRun = { signal: controller.signal, request };
			this.loading = 'fresh';
			// An aborted page never clears its own flag.
			this.loadingMore = false;
			this.searchError = null;
			searchLogs(request, controller.signal)
				.then((result) => {
					if (controller.signal.aborted) return;
					this.rawHits = result.rawHits;
					this.#expandedFolds.clear();
					this.hasSearched = true;
					this.#onFreshSearch?.();
					this.#lastBatchFull = result.rawHits.length === BATCH_SIZE;
					this.elapsedTimeMicros = result.elapsedTimeMicros;
					this.#countPaths(result.rawHits);
				})
				.catch((e: unknown) => {
					if (controller.signal.aborted) return;
					this.searchError = e instanceof Error ? e.message : 'Search failed';
					this.rawHits = [];
					this.#countPaths([]);
					this.elapsedTimeMicros = 0;
					this.#lastBatchFull = false;
				})
				.finally(() => {
					if (!controller.signal.aborted) this.loading = 'idle';
				});
			return () => controller.abort();
		});

		$effect(() => {
			const input = this.#input;
			if (input === null) {
				this.histogramLoading = false;
				return;
			}
			const controller = new AbortController();
			this.histogramLoading = true;
			this.histogramError = null;
			this.numHits = null;
			fetchHistogram(input, controller.signal)
				.then((result) => {
					if (controller.signal.aborted) return;
					this.histogramBuckets = result.buckets;
					this.histogramIntervalSec = result.intervalSec;
					this.numHits = result.totalDocCount;
					// The raw query, not the composed one: a filter change merges into the roster.
					const rosterKey = `${input.indexId}|${this.query}|${this.#rangeKey}`;
					const fresh = this.#computeLevelTotals(result.buckets);
					if (rosterKey !== this.#levelsRosterKey) {
						this.#levelsRosterKey = rosterKey;
						this.levels = fresh;
					} else {
						this.levels = this.#mergeLevels(this.levels, fresh);
					}
				})
				.catch((e: unknown) => {
					if (controller.signal.aborted) return;
					this.histogramError = e instanceof Error ? e.message : 'Histogram fetch failed';
					this.histogramBuckets = [];
					this.numHits = null;
				})
				.finally(() => {
					if (!controller.signal.aborted) this.histogramLoading = false;
				});
			return () => controller.abort();
		});

		$effect(() => {
			const indexId = this.#index;
			if (indexId === null) return;
			this.fieldConfig = null;
			this.configError = null;
			let stale = false;
			getIndexConfig(indexId)
				.then((cfg) => {
					if (!stale) this.fieldConfig = cfg;
				})
				.catch((e: unknown) => {
					if (stale) return;
					this.configError = e instanceof Error ? e.message : 'Failed to load index config';
				});
			return () => {
				stale = true;
			};
		});

		// A failed load keeps the defaults until the next index; nothing else retries it.
		$effect(() => {
			const indexId = this.#index;
			if (indexId === null) return;
			const saveSeqAtStart = this.#prefSaveSeq;
			let stale = false;
			getPreferences(indexId)
				.catch((e: unknown): Preferences => {
					if (!stale) {
						toast.error(e instanceof Error ? e.message : 'Failed to load display preferences');
					}
					return DEFAULT_PREFS;
				})
				.then((prefs) => {
					if (stale) return;
					this.#confirmedPrefs = prefs;
					// Local edits win, but retain the server value for rollback if their save fails.
					if (this.#prefSaveSeq !== saveSeqAtStart) return;
					this.#savedFields = prefs.displayFields;
					this.lineWrap = prefs.lineWrap;
					this.displayMode = prefs.displayMode;
				});
			return () => {
				stale = true;
			};
		});

		// Reads the serialized range, never resolved seconds: a relative preset resolves to a new `now`
		// on every read and would never settle.
		$effect(() => {
			const indexId = this.#index;
			const cfg = this.fieldConfig;
			const loadedFor = this.#fieldsKey;
			void this.#fieldsReload;
			// A config reload nulls `fieldConfig`, which tears down the run still loading the old fields.
			if (indexId === null || cfg === null) {
				this.fieldsLoading = false;
				this.#fieldsLoadedFor = null;
				return;
			}
			const controller = new AbortController();
			this.fieldsLoading = true;
			this.fieldsError = null;
			loadFields(
				indexId,
				cfg,
				untrack(() => resolveWindow(this.timeRange)),
				controller.signal
			)
				.then((fields) => {
					if (controller.signal.aborted) return;
					this.#schemaFields = fields;
					this.#fieldsLoadedFor = loadedFor;
				})
				.catch((e: unknown) => {
					if (controller.signal.aborted) return;
					this.fieldsError = e instanceof Error ? e.message : 'Failed to load fields';
					this.#schemaFields = [];
					this.#fieldsLoadedFor = null;
				})
				.finally(() => {
					if (!controller.signal.aborted) this.fieldsLoading = false;
				});
			return () => controller.abort();
		});
	}

	#canFetchMore(): boolean {
		return (
			this.loading === 'idle' &&
			!this.loadingMore &&
			this.#lastBatchFull &&
			this.rawHits.length < MAX_OFFSET &&
			(this.numHits === null || this.rawHits.length < this.numHits)
		);
	}

	/** Appends the next page of the current search, on its window; a new search aborts it. */
	maybeLoadMore(): void {
		const run = this.#searchRun;
		if (run === undefined || !this.#canFetchMore()) return;
		// Appending happens ahead of the viewport, so it stays silent.
		this.loadingMore = true;
		searchLogs({ ...run.request, offset: this.rawHits.length }, run.signal)
			.then((result) => {
				if (run.signal.aborted) return;
				this.rawHits = [...this.rawHits, ...result.rawHits];
				this.#lastBatchFull = result.rawHits.length === BATCH_SIZE;
			})
			// A failed page leaves the list as it is; the next scroll retries it.
			.catch(() => {})
			.finally(() => {
				if (!run.signal.aborted) this.loadingMore = false;
			});
	}

	get listEnd(): 'more' | 'end' | 'capped' {
		if (this.numHits !== null && this.rawHits.length >= this.numHits) return 'end';
		if (this.rawHits.length >= MAX_OFFSET) return 'capped';
		return this.#lastBatchFull ? 'more' : 'end';
	}

	/** Re-runs field discovery for the current index and range. */
	reloadFields(): void {
		this.#fieldsReload += 1;
	}

	/** One fixed slice — the first page. Accumulating across scroll pages would reorder the panel. */
	#countPaths(hits: Record<string, unknown>[]): void {
		try {
			this.fieldSample = countFieldPaths(hits);
		} catch (e) {
			console.warn('[search] field-path sampling failed', e);
		}
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
		const snapshot = {
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

	/** Flushes any pending preference save; the request effects cancel themselves on teardown.
	 *  Installed as the destroy cleanup by setupAutoSearch; idempotent. */
	dispose(): void {
		if (this.#disposed) return;
		this.#disposed = true;
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
