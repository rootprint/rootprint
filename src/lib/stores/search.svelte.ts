import { toast } from 'svelte-sonner';

import { browser } from '$app/environment';
import { goto, invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { recordSearch } from '$lib/api/history.remote';
import { getIndexConfig, getIndexFields } from '$lib/api/indexes.remote';
import { searchFieldValues, searchLogHistogram, searchLogs } from '$lib/api/logs.remote';
import { getPreference, saveDisplayFields } from '$lib/api/preferences.remote';
import { BUILTIN_VIEWS } from '$lib/constants/builtin-views';
import { DEFAULT_FIELD_CONFIG, OTEL_INDEX_PREFIX } from '$lib/constants/defaults';
import { QUICKWIT_AGG_MAX } from '$lib/constants/ingest';
import { storageKeys } from '$lib/constants/storage-keys';
import type { SearchLogsInput } from '$lib/schemas/logs';
import type {
	ActiveViewRef,
	BuiltinView,
	IndexField,
	IndexSummary,
	LoadingMode,
	LogEntry,
	ParsedQuery,
	QuickFilterBucket,
	TimeRange,
	ViewSummary
} from '$lib/types';
import { readActiveView, writeActiveView } from '$lib/utils/active-view-storage';
import { computeColumnWidths } from '$lib/utils/column-width';
import { useDebounce } from '$lib/utils/debounce';
import { getErrorMessage } from '$lib/utils/error';
import { extractJsonSubFields } from '$lib/utils/fields';
import { createLogKeyer } from '$lib/utils/log-helpers';
import {
	addClause as addClauseUtil,
	clearClauses as clearClausesUtil,
	consolidateClauses,
	hasClause as hasClauseUtil,
	parseClauses,
	removeClause as removeClauseUtil,
	shouldAutoClear
} from '$lib/utils/query';
import { buildQueryUrl, serialize } from '$lib/utils/query-params';
import { resolveTimeRange } from '$lib/utils/time';

const BATCH_SIZE = 50;

function resolveActiveView(
	ref: ActiveViewRef | null,
	builtins: BuiltinView[],
	userViewList: ViewSummary[]
): BuiltinView | ViewSummary | null {
	if (ref === null) return null;
	if (ref.kind === 'user') {
		return userViewList.find((v) => v.id === ref.id) ?? null;
	}
	return builtins.find((v) => v.slug === ref.slug) ?? null;
}

export function createSearchStore(
	parsedQuery: () => ParsedQuery,
	initialIndexes: IndexSummary[],
	userViews: () => ViewSummary[],
	options?: { onFreshSearch?: () => void }
) {
	const withKeys = createLogKeyer();

	const indexes = $state(initialIndexes);
	let selectedIndex = $state<string | null>(null);

	let fieldConfig = $state<{
		levelField: string;
		timestampField: string;
		messageField: string;
		tracebackField: string | null;
	}>({ ...DEFAULT_FIELD_CONFIG });
	let indexFields = $state<IndexField[]>([]);
	let schemaFields = $state<IndexField[]>([]);
	let activeFields = $state<string[]>([]);
	// Snapshot of the user's saved display-fields preference. Refreshed when
	// the index loads and after each debounced autosave with no view active.
	// Restored into activeFields when the user clears the active view.
	let savedDisplayFields: string[] = [];
	let fieldsLoading = $state(false);
	let activeViewRef = $state<ActiveViewRef | null>(null);

	let logs = $state<LogEntry[]>([]);
	let numHits = $state(0);
	let loadingModeState = $state<LoadingMode>('idle');
	let hasSearched = $state(false);
	let searchError = $state<string | null>(null);

	const loadingMode = $derived<LoadingMode>(
		loadingModeState !== 'idle'
			? loadingModeState
			: selectedIndex !== null && !hasSearched && searchError === null
				? 'fresh'
				: 'idle'
	);
	let searchStartTimestamp: number | undefined;
	let searchEndTimestamp: number | undefined;

	let histogramData = $state<{ timestamp: number; levels: Record<string, number> }[]>([]);
	let histogramLoading = $state(false);
	let histogramRequestId = 0;
	let searchRequestId = 0;
	let searchCompletedCount = $state(0);

	let levelBucketsLoading = $state(false);
	let levelBucketsRequestId = 0;

	const logHits = $derived(logs.map((e) => e.hit));
	const columnWidths = $derived(computeColumnWidths(logHits, activeFields));

	let aggregations = $state<Record<string, QuickFilterBucket[]>>({});

	let searchVersion = $state(0);
	let lastSearchedKey = '';
	let shouldRecordHistory = false;

	let autoRefreshInterval = $state<number | null>(null);
	let autoRefreshTimerId: ReturnType<typeof setInterval> | null = null;

	const timeRange = $derived(parsedQuery().timeRange);
	const timezoneMode = $derived(parsedQuery().timezoneMode);
	const urlIndex = $derived(parsedQuery().index);
	const sortDirection = $derived(parsedQuery().sortDirection);
	const canAutoRefresh = $derived(timeRange.type === 'relative');
	const isOtelIndex = $derived(selectedIndex?.startsWith(OTEL_INDEX_PREFIX) ?? false);

	const excludedFields = $derived(new Set([fieldConfig.timestampField, fieldConfig.messageField]));
	const panelAvailableFields = $derived(indexFields.filter((f) => !excludedFields.has(f.name)));

	const activeView = $derived<BuiltinView | ViewSummary | null>(
		resolveActiveView(activeViewRef, BUILTIN_VIEWS, userViews())
	);

	function getQueryText(): string {
		return parsedQuery().query || '*';
	}

	function buildTimeParams(
		range: TimeRange
	): Pick<SearchLogsInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'> {
		if (range.type === 'relative') {
			return { timeRange: range.preset as SearchLogsInput['timeRange'] };
		}
		return { startTimestamp: range.start, endTimestamp: range.end };
	}

	function bumpSearch() {
		searchVersion++;
	}

	function navigateQuery(partial: Partial<ParsedQuery>, opts?: { push?: boolean }) {
		if (partial.query !== undefined) {
			partial = { ...partial, query: consolidateClauses(partial.query) };
		}
		const url = buildQueryUrl(page.url.searchParams, partial);
		goto(url, {
			replaceState: !opts?.push,
			keepFocus: true,
			noScroll: true
		});
	}

	function runQuery(query: string) {
		const pq = parsedQuery();
		shouldRecordHistory = true;
		if (query === pq.query) {
			bumpSearch();
		} else {
			navigateQuery({ query }, { push: true });
		}
	}

	function recordCurrentSearch(query: string) {
		if (!selectedIndex) return;
		recordSearch({
			indexId: selectedIndex,
			query,
			timeRange
		})
			.then(() => {
				invalidateAll();
			})
			.catch((e) => console.warn('Failed to record search history', e));
	}

	// Reads the stored ref for `indexName`, applies the view's columns to
	// `activeFields` and sets `activeViewRef` if it resolves. Self-heals stale
	// built-in refs by clearing localStorage; leaves user refs intact (they may
	// resolve after data.views refreshes for the new URL index on next load).
	// Caller is responsible for any URL navigation.
	function hydrateActiveViewForIndex(indexName: string): BuiltinView | ViewSummary | null {
		const ref = readActiveView(indexName);
		if (!ref) {
			activeViewRef = null;
			return null;
		}
		const view = resolveActiveView(ref, BUILTIN_VIEWS, userViews());
		if (view) {
			activeViewRef = ref;
			activeFields = [...view.columns];
			return view;
		}
		if (ref.kind === 'builtin') writeActiveView(indexName, null);
		activeViewRef = null;
		return null;
	}

	function applyView(ref: ActiveViewRef): void {
		const view = resolveActiveView(ref, BUILTIN_VIEWS, userViews());
		if (!view) return;
		activeViewRef = ref;
		if (selectedIndex) writeActiveView(selectedIndex, ref);
		activeFields = [...view.columns];
		navigateQuery({ query: view.query }, { push: true });
	}

	function clearActiveView(): void {
		activeViewRef = null;
		if (selectedIndex) writeActiveView(selectedIndex, null);
		activeFields = [...savedDisplayFields];
		navigateQuery({ query: '' }, { push: true });
	}

	function pickInitialIndex(urlIdx: string | null): string {
		if (urlIdx && indexes.some((i) => i.indexId === urlIdx)) return urlIdx;
		const saved = localStorage.getItem(storageKeys.selectedIndex);
		if (saved && indexes.some((i) => i.indexId === saved)) return saved;
		return indexes[0].indexId;
	}

	function initIndexes() {
		if (!browser) return;
		if (indexes.length === 0 || selectedIndex !== null) return;

		const urlIdx = urlIndex;
		const idx = pickInitialIndex(urlIdx);

		selectedIndex = idx;
		localStorage.setItem(storageKeys.selectedIndex, idx);

		hydrateActiveViewForIndex(idx);

		if (urlIdx !== idx) {
			navigateQuery({ index: idx });
		}
		loadFieldsForIndex(idx);
	}

	async function loadFieldsForIndex(indexName: string) {
		fieldsLoading = true;
		try {
			const [indexFieldsResult, config, pref] = await Promise.all([
				getIndexFields({ indexId: indexName }),
				getIndexConfig({ indexId: indexName }),
				getPreference({ indexId: indexName })
			]);
			indexFields = indexFieldsResult.fields;
			schemaFields = indexFieldsResult.fields;
			fieldConfig = config;
			savedDisplayFields = pref.displayFields;
			if (activeViewRef === null) {
				activeFields = pref.displayFields;
			}
		} catch {
			indexFields = [];
			if (activeViewRef === null) activeFields = [];
		} finally {
			fieldsLoading = false;
		}
	}

	function handleIndexChange(indexName: string) {
		selectedIndex = indexName;
		if (browser) localStorage.setItem(storageKeys.selectedIndex, indexName);
		aggregations = {};
		schemaFields = [];
		fieldsLoading = true; // block auto-search until new fields load

		const view = hydrateActiveViewForIndex(indexName);
		if (view) {
			navigateQuery({ index: indexName, query: view.query });
		} else {
			activeFields = [];
			navigateQuery({ index: indexName, query: '' });
		}

		loadFieldsForIndex(indexName);
	}

	const { debounced: handleFieldsChange } = useDebounce(() => {
		if (!selectedIndex) return;
		// Only persist column changes when no view is active. While a view is
		// active, column edits stay session-only — clearing the view restores
		// the user's saved default columns. Use the resolved `activeView` (not
		// the raw ref) so that a stale ref does not silently suppress autosave.
		if (activeView !== null) return;
		savedDisplayFields = [...activeFields];
		saveDisplayFields({ indexId: selectedIndex, fields: activeFields }).catch((e) =>
			toast.error(getErrorMessage(e, 'Failed to save display fields'))
		);
	}, 500);

	async function search(opts?: { append?: boolean }) {
		const append = opts?.append ?? false;
		if (selectedIndex === null) return;

		const requestId = ++searchRequestId;

		loadingModeState = append ? 'appending' : 'fresh';
		searchError = null;

		try {
			const queryText = getQueryText();
			const currentTimeRange = timeRange;

			const timeParams = append
				? { startTimestamp: searchStartTimestamp, endTimestamp: searchEndTimestamp }
				: buildTimeParams(currentTimeRange);

			if (!append) {
				fetchHistogram();
				fetchLevelBuckets(timeParams);
			}

			const result = await searchLogs({
				indexId: selectedIndex,
				query: queryText,
				...timeParams,
				offset: append ? logs.length : 0,
				limit: BATCH_SIZE,
				sortDirection
			});

			if (requestId !== searchRequestId) return;

			searchStartTimestamp = result.startTimestamp;
			searchEndTimestamp = result.endTimestamp;

			if (append) {
				logs = [...logs, ...withKeys(result.hits)];
			} else {
				logs = withKeys(result.hits);
				options?.onFreshSearch?.();
			}
			numHits = result.numHits;
			searchCompletedCount++;

			if (result.hits.length > 0) {
				const jsonFields = new Map(
					schemaFields.filter((f) => f.type === 'json').map((f) => [f.name, f.fast] as const)
				);
				if (jsonFields.size > 0) {
					const discovered = extractJsonSubFields(result.hits, jsonFields);
					if (append) {
						const schemaNames = new Set(schemaFields.map((f) => f.name));
						const existingDiscovered = indexFields.filter((f) => !schemaNames.has(f.name));
						const existingNames = new Set(existingDiscovered.map((f) => f.name));
						const newDiscovered = discovered.filter((f) => !existingNames.has(f.name));
						if (newDiscovered.length > 0) {
							const nonJson = schemaFields.filter((f) => f.type !== 'json');
							indexFields = [...nonJson, ...existingDiscovered, ...newDiscovered];
						}
					} else {
						const nonJson = schemaFields.filter((f) => f.type !== 'json');
						indexFields = [...nonJson, ...discovered];
					}
				}
			}

			hasSearched = true;

			if (!append && shouldRecordHistory) {
				shouldRecordHistory = false;
				recordCurrentSearch(parsedQuery().query);
			}
		} catch (e) {
			if (requestId !== searchRequestId) return;
			const message = getErrorMessage(e, 'Search failed');
			searchError = message;
			logs = [];
			numHits = 0;
			hasSearched = true;
			toast.error(message);
		} finally {
			if (requestId === searchRequestId) {
				loadingModeState = 'idle';
			}
		}
	}

	async function fetchHistogram() {
		if (selectedIndex === null) return;

		const requestId = ++histogramRequestId;
		histogramLoading = true;
		try {
			const queryText = getQueryText();
			const currentTimeRange = timeRange;

			const timeParams = buildTimeParams(currentTimeRange);

			const result = await searchLogHistogram({
				indexId: selectedIndex,
				query: queryText,
				...timeParams
			});
			if (requestId !== histogramRequestId) return;
			histogramData = result.buckets;
		} catch {
			if (requestId !== histogramRequestId) return;
			histogramData = [];
		} finally {
			if (requestId === histogramRequestId) {
				histogramLoading = false;
			}
		}
	}

	async function fetchLevelBuckets(
		timeParams: Pick<SearchLogsInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'>
	) {
		if (selectedIndex === null) return;

		const requestId = ++levelBucketsRequestId;
		levelBucketsLoading = true;
		try {
			const queryText = getQueryText();
			const levelField = fieldConfig.levelField;
			const queryStr = parsedQuery().query;
			const result = await searchFieldValues({
				indexId: selectedIndex,
				field: levelField,
				searchTerm: '',
				query: queryText,
				...timeParams
			});
			if (requestId !== levelBucketsRequestId) return;

			if (result.unsupported) {
				aggregations = {};
				return;
			}

			const hasActiveClauses = queryStr.length > 0 && parseClauses(queryStr).length > 0;
			if (hasActiveClauses) {
				const merged = new Map<string, QuickFilterBucket>();
				for (const prev of aggregations[levelField] ?? []) {
					merged.set(prev.value, { value: prev.value, count: null });
				}
				for (const fresh of result.values) {
					merged.set(fresh.value, fresh);
				}
				aggregations = { [levelField]: [...merged.values()].slice(0, QUICKWIT_AGG_MAX) };
			} else {
				aggregations = { [levelField]: result.values };
			}
		} catch {
			if (requestId !== levelBucketsRequestId) return;
			// Leave existing aggregations in place on transient failure.
		} finally {
			if (requestId === levelBucketsRequestId) {
				levelBucketsLoading = false;
			}
		}
	}

	async function searchFieldValuesHandler(
		field: string,
		searchTerm: string
	): Promise<{ values: QuickFilterBucket[]; totalHits: number }> {
		if (!selectedIndex) return { values: [], totalHits: 0 };
		const queryText = getQueryText();
		const result = await searchFieldValues({
			indexId: selectedIndex,
			field,
			searchTerm,
			query: queryText,
			startTimestamp: searchStartTimestamp,
			endTimestamp: searchEndTimestamp
		});
		return { values: result.values, totalHits: result.totalHits };
	}

	function addClause(field: string, value: string, exclude = false) {
		const currentQuery = parsedQuery().query;
		const knownBuckets = aggregations[field];
		const knownValues = knownBuckets?.map((b) => b.value);

		if (knownValues && shouldAutoClear(knownValues, field, currentQuery, value, exclude)) {
			let cleared = currentQuery;
			for (const v of knownValues) {
				cleared = removeClauseUtil(cleared, field, v, false);
			}
			navigateQuery({ query: cleared }, { push: true });
			return;
		}

		const newQuery = addClauseUtil(currentQuery, field, value, exclude);
		navigateQuery({ query: newQuery }, { push: true });
	}

	function removeClause(field: string, value: string, exclude = false) {
		const newQuery = removeClauseUtil(parsedQuery().query, field, value, exclude);
		navigateQuery({ query: newQuery }, { push: true });
	}

	function hasClauseCheck(field: string, value: string, exclude = false): boolean {
		return hasClauseUtil(parsedQuery().query, field, value, exclude);
	}

	function clearAllClauses() {
		const newQuery = clearClausesUtil(parsedQuery().query);
		navigateQuery({ query: newQuery }, { push: true });
	}

	function toggleSortDirection() {
		const current = parsedQuery().sortDirection;
		navigateQuery({ sortDirection: current === 'desc' ? 'asc' : 'desc' });
	}

	function clearAutoRefreshTimer() {
		if (autoRefreshTimerId !== null) {
			clearInterval(autoRefreshTimerId);
			autoRefreshTimerId = null;
		}
	}

	function startAutoRefresh(intervalMs: number) {
		clearAutoRefreshTimer();
		autoRefreshInterval = intervalMs;
		autoRefreshTimerId = setInterval(() => bumpSearch(), intervalMs);
	}

	function stopAutoRefresh() {
		clearAutoRefreshTimer();
		autoRefreshInterval = null;
	}

	function setAutoRefresh(intervalMs: number | null) {
		if (intervalMs === null) {
			stopAutoRefresh();
		} else {
			startAutoRefresh(intervalMs);
		}
	}

	initIndexes();

	// Must be called in component context — sets up $effects that drive the
	// auto-search loop and auto-refresh visibility handling.
	function setupAutoSearch() {
		// Restore index in URL when it's lost (e.g. clicking the logo link)
		$effect(() => {
			if (urlIndex === null && selectedIndex !== null && indexes.length > 0) {
				navigateQuery({ index: selectedIndex });
			}
		});

		$effect(() => {
			const parsed = parsedQuery();
			const currentParams = serialize(parsed).toString();
			const version = searchVersion;
			const loading = fieldsLoading;

			if (loading) return;
			if (parsed.index === null) return;
			if (parsed.index !== selectedIndex) return;

			const key = `${currentParams}\0${version}`;
			if (key === lastSearchedKey) return;
			lastSearchedKey = key;
			search();
		});

		$effect(() => {
			if (!canAutoRefresh && autoRefreshInterval !== null) {
				stopAutoRefresh();
			}
		});

		// Pause the timer while the tab is hidden (preserves the configured
		// interval so resume works), and fire one immediate refresh on return.
		$effect(() => {
			if (!browser) return;
			const interval = autoRefreshInterval;
			if (interval === null) return;

			function onVisibilityChange() {
				if (document.hidden) {
					clearAutoRefreshTimer();
				} else if (autoRefreshInterval !== null) {
					bumpSearch();
					startAutoRefresh(autoRefreshInterval);
				}
			}

			document.addEventListener('visibilitychange', onVisibilityChange);
			return () => document.removeEventListener('visibilitychange', onVisibilityChange);
		});

		$effect(() => {
			return () => stopAutoRefresh();
		});
	}

	return {
		get indexes() {
			return indexes;
		},
		get selectedIndex() {
			return selectedIndex;
		},
		get fieldConfig() {
			return fieldConfig;
		},
		get levelField() {
			return fieldConfig.levelField;
		},
		get timestampField() {
			return fieldConfig.timestampField;
		},
		get messageField() {
			return fieldConfig.messageField;
		},
		get indexFields() {
			return indexFields;
		},
		get schemaFields() {
			return schemaFields;
		},
		get activeFields() {
			return activeFields;
		},
		set activeFields(v: string[]) {
			activeFields = v;
		},
		get fieldsLoading() {
			return fieldsLoading;
		},
		get logs() {
			return logs;
		},
		get numHits() {
			return numHits;
		},
		get searchCompletedCount() {
			return searchCompletedCount;
		},
		get loadingMode() {
			return loadingMode;
		},
		get hasSearched() {
			return hasSearched;
		},
		get searchError() {
			return searchError;
		},
		get histogramData() {
			return histogramData;
		},
		get histogramLoading() {
			return histogramLoading;
		},
		get levelBucketsLoading() {
			return levelBucketsLoading;
		},
		get columnWidths() {
			return columnWidths;
		},
		get aggregations() {
			return aggregations;
		},
		get timeRange() {
			return timeRange;
		},
		get timezoneMode() {
			return timezoneMode;
		},
		get sortDirection() {
			return sortDirection;
		},
		get absoluteTimeRange() {
			const resolved = resolveTimeRange(parsedQuery().timeRange);
			return { start: resolved.startTs ?? 0, end: resolved.endTs ?? 0 };
		},
		get panelAvailableFields() {
			return panelAvailableFields;
		},
		get activeView() {
			return activeView;
		},
		get queryText() {
			return getQueryText();
		},
		get autoRefreshInterval() {
			return autoRefreshInterval;
		},
		get canAutoRefresh() {
			return canAutoRefresh;
		},
		get isOtelIndex() {
			return isOtelIndex;
		},
		setAutoRefresh,
		navigateQuery,
		runQuery,
		handleIndexChange,
		handleFieldsChange,
		search,
		searchFieldValues: searchFieldValuesHandler,
		setupAutoSearch,
		bumpSearch,
		addClause,
		removeClause,
		hasClause: hasClauseCheck,
		clearClauses: clearAllClauses,
		toggleSortDirection,
		applyView,
		clearActiveView
	};
}
