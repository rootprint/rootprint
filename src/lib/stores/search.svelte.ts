import { getIndexFields, getIndexConfig } from '$lib/api/indexes.remote';
import { searchLogs, searchFieldValues, searchLogHistogram } from '$lib/api/logs.remote';
import {
	getPreference,
	saveDisplayFields,
	saveQuickFilterFields
} from '$lib/api/preferences.remote';
import { recordSearch } from '$lib/api/history.remote';
import { invalidateAll } from '$app/navigation';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { combineQueryWithFilters, escapeFilterValue } from '$lib/utils/query';
import { buildQueryUrl, serialize } from '$lib/utils/query-params';
import { computeColumnWidths, computeTimestampWidth } from '$lib/utils/column-width';
import { extractJsonSubFields } from '$lib/utils/fields';
import type { SearchLogsInput } from '$lib/schemas/logs';
import type { IndexField, LogEntry, ParsedQuery, TimeRange } from '$lib/types';
import { toast } from 'svelte-sonner';
import { getErrorMessage } from '$lib/utils/error';

const BATCH_SIZE = 50;

export function createSearchStore(
	parsedQuery: () => ParsedQuery,
	initialIndexes: { indexId: string; indexUri: string }[],
	options?: { onFreshSearch?: () => void }
) {
	let nextKey = 0;

	function withKeys(hits: Record<string, unknown>[]): LogEntry[] {
		return hits.map((hit) => ({ key: nextKey++, hit }));
	}

	// --- Index state ---
	let indexes = $state(initialIndexes);
	let selectedIndex = $state<string | null>(null);

	// --- Field config state ---
	let fieldConfig = $state<{
		levelField: string;
		timestampField: string;
		messageField: string;
		tracebackField: string | null;
	}>({
		levelField: 'level',
		timestampField: 'timestamp',
		messageField: 'message',
		tracebackField: null
	});
	let indexFields = $state<IndexField[]>([]);
	let schemaFields = $state<IndexField[]>([]);
	let activeFields = $state<string[]>([]);
	let fieldsLoading = $state(false);
	let quickFilterFields = $state<string[]>([]);

	// --- Search result state ---
	let logs = $state<LogEntry[]>([]);
	let numHits = $state(0);
	let loading = $state(false);
	let hasSearched = $state(false);
	let searchError = $state<string | null>(null);
	let searchStartTimestamp = $state<number | undefined>(undefined);
	let searchEndTimestamp = $state<number | undefined>(undefined);

	// --- Histogram state ---
	let histogramData = $state<{ timestamp: number; levels: Record<string, number> }[]>([]);
	let histogramLoading = $state(false);
	let histogramRequestId = 0;

	// --- Column widths ---
	let columnWidths = $derived(
		computeColumnWidths(
			logs.map((e) => e.hit),
			activeFields
		)
	);

	// --- Aggregations ---
	let aggregations = $state<Record<string, string[]>>({});

	// --- Search version ---
	let searchVersion = $state(0);
	let lastSearchedKey = '';
	let shouldRecordHistory = false;

	// --- Derived state ---
	let timeRange = $derived(parsedQuery().timeRange);
	let timezoneMode = $derived(parsedQuery().timezoneMode);
	let timestampWidth = $derived(
		computeTimestampWidth(
			logs.map((e) => e.hit),
			fieldConfig.timestampField,
			timezoneMode
		)
	);
	let activeFilters = $derived(parsedQuery().filters);
	let urlIndex = $derived(parsedQuery().index);

	let excludedFields = $derived(
		new Set([fieldConfig.levelField, fieldConfig.timestampField, fieldConfig.messageField])
	);
	let panelAvailableFields = $derived(indexFields.filter((f) => !excludedFields.has(f.name)));
	let quickFilterExcludedFields = $derived(
		new Set([fieldConfig.timestampField, fieldConfig.messageField])
	);
	let quickFilterAvailableFields = $derived(
		indexFields.filter((f) => f.fast && !quickFilterExcludedFields.has(f.name))
	);

	// --- Internal helpers ---

	function getQueryText() {
		const pq = parsedQuery();
		return combineQueryWithFilters(pq.query, pq.filters);
	}

	function buildTimeParams(
		range: TimeRange,
		override?: { startTimestamp?: number; endTimestamp?: number }
	): Pick<SearchLogsInput, 'timeRange' | 'startTimestamp' | 'endTimestamp'> {
		if (override) {
			return { startTimestamp: override.startTimestamp, endTimestamp: override.endTimestamp };
		}
		if (range.type === 'relative') {
			return { timeRange: range.preset as SearchLogsInput['timeRange'] };
		}
		return { startTimestamp: range.start, endTimestamp: range.end };
	}

	function bumpSearch() {
		searchVersion++;
	}

	// --- Navigation ---

	function navigateQuery(partial: Partial<ParsedQuery>, opts?: { push?: boolean }) {
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
			timeRange,
			filters: activeFilters
		})
			.then(() => {
				invalidateAll();
			})
			.catch((e) => console.warn('Failed to record search history', e));
	}

	// --- Index loading ---

	function initIndexes() {
		if (!browser) return;
		if (indexes.length > 0 && selectedIndex === null) {
			const urlIdx = urlIndex;

			let idx: string;
			if (urlIdx && indexes.some((i) => i.indexId === urlIdx)) {
				idx = urlIdx;
			} else {
				const saved = localStorage.getItem('logwiz:selectedIndex');
				if (saved && indexes.some((i) => i.indexId === saved)) {
					idx = saved;
				} else {
					idx = indexes[0].indexId;
				}
			}

			selectedIndex = idx;
			localStorage.setItem('logwiz:selectedIndex', idx);
			if (urlIdx !== idx) {
				navigateQuery({ index: idx });
			}
			loadFieldsForIndex(idx);
		}
	}

	async function loadFieldsForIndex(indexName: string) {
		fieldsLoading = true;
		try {
			const [indexFieldsResult, config, pref] = await Promise.all([
				getIndexFields({ indexId: indexName }),
				getIndexConfig(indexName),
				getPreference({ indexId: indexName })
			]);
			indexFields = indexFieldsResult.fields;
			schemaFields = indexFieldsResult.fields;
			fieldConfig = config;
			activeFields = pref.displayFields;

			const levelField = config.levelField;
			const savedFields = (
				pref.quickFilterFields.length > 0 ? pref.quickFilterFields : [levelField]
			).filter((f) => f !== levelField);
			quickFilterFields = [levelField, ...savedFields];
			// search() removed — auto-search fires when fieldsLoading becomes false
		} catch {
			indexFields = [];
			activeFields = [];
			quickFilterFields = [];
		} finally {
			fieldsLoading = false;
		}
	}

	function handleIndexChange(indexName: string) {
		selectedIndex = indexName;
		if (browser) localStorage.setItem('logwiz:selectedIndex', indexName);
		aggregations = {};
		schemaFields = [];
		fieldsLoading = true; // block auto-search until new fields load
		navigateQuery({ index: indexName, filters: {} });
		loadFieldsForIndex(indexName);
	}

	// --- Field change handlers ---

	function debounce(fn: () => void, ms: number) {
		let timer: ReturnType<typeof setTimeout>;
		return () => {
			clearTimeout(timer);
			timer = setTimeout(fn, ms);
		};
	}

	const debouncedSaveFields = debounce(() => {
		if (selectedIndex) {
			saveDisplayFields({ indexId: selectedIndex, fields: activeFields }).catch((e) =>
				toast.error(getErrorMessage(e, 'Failed to save display fields'))
			);
		}
	}, 500);

	function handleFieldsChange() {
		debouncedSaveFields();
	}

	const debouncedSaveQuickFilters = debounce(() => {
		if (selectedIndex) {
			saveQuickFilterFields({ indexId: selectedIndex, fields: quickFilterFields }).catch((e) =>
				toast.error(getErrorMessage(e, 'Failed to save quick filter fields'))
			);
		}
	}, 500);

	function handleQuickFilterFieldsChange(fields: string[]) {
		const levelField = fieldConfig.levelField;
		const otherFields = fields.filter((f) => f !== levelField);
		quickFilterFields = [levelField, ...otherFields];
		const fieldSet = new Set(fields);
		aggregations = Object.fromEntries(
			Object.entries(aggregations).filter(([k]) => fieldSet.has(k))
		);
		const cleanedFilters = Object.fromEntries(
			Object.entries(activeFilters).filter(([k]) => fieldSet.has(k))
		);
		if (JSON.stringify(cleanedFilters) !== JSON.stringify(activeFilters)) {
			navigateQuery({ filters: cleanedFilters });
		} else if (hasSearched) {
			bumpSearch();
		}
		debouncedSaveQuickFilters();
	}

	// --- Search ---

	async function search(opts?: { append?: boolean }) {
		const append = opts?.append ?? false;
		if (selectedIndex === null) return;

		loading = true;
		searchError = null;

		try {
			const queryText = getQueryText();
			const currentTimeRange = timeRange;

			const timeParams = append
				? buildTimeParams(currentTimeRange, {
						startTimestamp: searchStartTimestamp,
						endTimestamp: searchEndTimestamp
					})
				: buildTimeParams(currentTimeRange);

			if (!append) {
				fetchHistogram();
			}

			const result = await searchLogs({
				indexId: selectedIndex,
				query: queryText || '*',
				...timeParams,
				offset: append ? logs.length : 0,
				limit: BATCH_SIZE,
				quickFilterFields
			});

			searchStartTimestamp = result.startTimestamp;
			searchEndTimestamp = result.endTimestamp;

			if (result.unsupportedFilterFields?.length) {
				const bad = result.unsupportedFilterFields;
				const names = bad.join(', ');
				toast.error(
					`Filter field${bad.length > 1 ? 's' : ''} ${names} cannot be used as a filter (not a fast field in Quickwit)`
				);
				quickFilterFields = quickFilterFields.filter((f) => !bad.includes(f));
				if (selectedIndex) {
					saveQuickFilterFields({ indexId: selectedIndex, fields: quickFilterFields });
				}
			}

			if (!append && result.aggregations) {
				const hasActiveFiltersNow = Object.keys(activeFilters).length > 0;
				if (hasActiveFiltersNow) {
					const merged = { ...aggregations };
					for (const [field, values] of Object.entries(result.aggregations)) {
						if (!(field in merged)) {
							merged[field] = values;
						}
					}
					aggregations = merged;
				} else {
					aggregations = result.aggregations;
				}
			}

			if (append) {
				logs = [...logs, ...withKeys(result.hits)];
			} else {
				logs = withKeys(result.hits);
				options?.onFreshSearch?.();
			}
			numHits = result.numHits;

			if (result.hits.length > 0) {
				const jsonFields = new Map(
					schemaFields.filter((f) => f.type === 'json').map((f) => [f.name, f.fast] as const)
				);
				if (jsonFields.size > 0) {
					const discovered = extractJsonSubFields(result.hits, jsonFields);
					const nonJson = schemaFields.filter((f) => f.type !== 'json');
					if (append) {
						const existingDiscovered = indexFields.filter(
							(f) => !schemaFields.some((s) => s.name === f.name)
						);
						const existingNames = new Set(existingDiscovered.map((f) => f.name));
						const newDiscovered = discovered.filter((f) => !existingNames.has(f.name));
						if (newDiscovered.length > 0) {
							indexFields = [...nonJson, ...existingDiscovered, ...newDiscovered];
						}
					} else {
						indexFields = [...nonJson, ...discovered];
					}
				}
			}

			hasSearched = true;

			// Record history for user-initiated fresh searches only
			if (!append && shouldRecordHistory) {
				shouldRecordHistory = false;
				recordCurrentSearch(parsedQuery().query);
			}
		} catch (e) {
			const message = getErrorMessage(e, 'Search failed');
			searchError = message;
			logs = [];
			numHits = 0;
			hasSearched = true;
			toast.error(message);
		} finally {
			loading = false;
		}
	}

	// --- Histogram ---

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
				query: queryText || '*',
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

	// --- Field value search ---

	async function searchFieldValuesHandler(field: string, searchTerm: string): Promise<string[]> {
		if (!selectedIndex) return [];
		const queryText = getQueryText();
		const result = await searchFieldValues({
			indexId: selectedIndex,
			field,
			searchTerm,
			query: queryText || '*',
			startTimestamp: searchStartTimestamp,
			endTimestamp: searchEndTimestamp
		});
		return result.values;
	}

	function addFilterClause(field: string, value: string, exclude: boolean) {
		const escaped = escapeFilterValue(value);
		const clause = exclude ? `NOT ${field}:${escaped}` : `${field}:${escaped}`;
		const current = parsedQuery().query;
		const newQuery = current ? `${current} AND ${clause}` : clause;
		navigateQuery({ query: newQuery }, { push: true });
	}

	// --- Start loading immediately ---
	initIndexes();

	// --- Setup auto-search effect (must be called in component context) ---

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
	}

	// --- Return public API ---

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
		get quickFilterFields() {
			return quickFilterFields;
		},
		get logs() {
			return logs;
		},
		get numHits() {
			return numHits;
		},
		get loading() {
			return loading;
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
		get columnWidths() {
			return columnWidths;
		},
		get timestampWidth() {
			return timestampWidth;
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
		get activeFilters() {
			return activeFilters;
		},
		get panelAvailableFields() {
			return panelAvailableFields;
		},
		get quickFilterAvailableFields() {
			return quickFilterAvailableFields;
		},
		// Methods
		navigateQuery,
		runQuery,
		handleIndexChange,
		handleFieldsChange,
		handleQuickFilterFieldsChange,
		search,
		searchFieldValues: searchFieldValuesHandler,
		setupAutoSearch,
		bumpSearch,
		addFilterClause
	};
}
