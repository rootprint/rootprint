import { getIndexes, getIndexFields, getIndexConfig } from '$lib/api/indexes.remote';
import {
	searchLogs,
	searchFieldValues,
	searchLogHistogram,
	pollLiveLogs
} from '$lib/api/logs.remote';
import {
	getPreference,
	saveDisplayFields,
	saveQuickFilterFields
} from '$lib/api/preferences.remote';
import { untrack } from 'svelte';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { combineQueryWithFilters } from '$lib/utils/query';
import { buildQueryUrl, serialize, hasNonDefaultParams } from '$lib/utils/query-params';
import type { ParsedQuery } from '$lib/utils/query-params';
import { resolveTimeRange } from '$lib/utils/time';
import { computeColumnWidths } from '$lib/utils/column-width';
import { extractJsonSubFields } from '$lib/utils/fields';
import type { IndexField } from '$lib/types';
import { toast } from 'svelte-sonner';
import { getErrorMessage } from '$lib/utils/error';

const BATCH_SIZE = 50;

export function createSearchStore(
	parsedQuery: () => ParsedQuery,
	options?: { onFreshSearch?: () => void }
) {
	// --- Index state ---
	let indexes = $state<{ indexId: string; indexUri: string }[]>([]);
	let selectedIndex = $state<string | null>(null);

	// --- Field config state ---
	let fieldConfig = $state({
		levelField: 'level',
		timestampField: 'timestamp',
		messageField: 'message'
	});
	let indexFields = $state<IndexField[]>([]);
	let schemaFields = $state<IndexField[]>([]);
	let activeFields = $state<string[]>([]);
	let fieldsLoading = $state(false);
	let quickFilterFields = $state<string[]>([]);

	// --- Search result state ---
	let logs = $state<Record<string, unknown>[]>([]);
	let numHits = $state(0);
	let loading = $state(false);
	let hasSearched = $state(false);
	let searchStartTimestamp = $state<number | undefined>(undefined);
	let searchEndTimestamp = $state<number | undefined>(undefined);

	// --- Histogram state ---
	let histogramData = $state<{ timestamp: number; levels: Record<string, number> }[]>([]);
	let histogramLoading = $state(false);
	let histogramRequestId = 0;

	// --- Column widths ---
	let _maxRawWidths: Record<string, number> = {};
	let columnWidths = $state<Record<string, number>>({});

	// --- Aggregations ---
	let aggregations = $state<Record<string, string[]>>({});

	// --- Live mode state ---
	let isLive = $state(false);
	let liveIntervalId: ReturnType<typeof setTimeout> | null = null;
	let lastPollTimestamp = 0;
	let newLiveLogs = $state(0);
	let liveErrorShown = false;
	let lastPollKeys = new Set<string>();
	let liveSessionId = 0;

	// --- URL sync ---
	let lastSearchedParams = $state('');

	// --- Derived state ---
	let timeRange = $derived(parsedQuery().timeRange);
	let timezoneMode = $derived(parsedQuery().timezoneMode);
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
		indexFields.filter((f) => !quickFilterExcludedFields.has(f.name))
	);

	// --- Internal helpers ---

	function getQueryText() {
		const pq = parsedQuery();
		return combineQueryWithFilters(pq.query, pq.filters);
	}

	function docKey(doc: Record<string, unknown>): string {
		return JSON.stringify(doc);
	}

	function isActiveLiveSession(sessionId: number): boolean {
		return isLive && sessionId === liveSessionId;
	}

	function updateColumnWidths(newLogs: Record<string, unknown>[], fields: string[], reset = false) {
		if (reset) _maxRawWidths = {};
		const result = computeColumnWidths(newLogs, fields, _maxRawWidths);
		_maxRawWidths = result.maxRawWidths;
		columnWidths = result.widths;
	}

	// --- Navigation ---

	function navigateQuery(partial: Partial<ParsedQuery>, push = false) {
		const url = buildQueryUrl(page.url.searchParams, partial);
		goto(url, {
			replaceState: !push,
			keepFocus: true,
			noScroll: true
		});
	}

	function runQuery(query: string) {
		const pq = parsedQuery();
		if (query !== pq.query) {
			navigateQuery({ query }, true);
		} else {
			search();
		}
	}

	// --- Index loading ---

	async function loadIndexes() {
		try {
			indexes = await getIndexes();
			if (indexes.length > 0 && selectedIndex === null) {
				const urlIdx = urlIndex;

				let idx: string;
				if (urlIdx && indexes.some((i) => i.indexId === urlIdx)) {
					idx = urlIdx;
				} else {
					const saved = browser ? localStorage.getItem('logwiz:selectedIndex') : null;
					if (saved && indexes.some((i) => i.indexId === saved)) {
						idx = saved;
					} else {
						idx = indexes[0].indexId;
					}
				}

				selectedIndex = idx;
				if (browser) localStorage.setItem('logwiz:selectedIndex', idx);
				if (urlIdx !== idx) {
					navigateQuery({ index: idx });
				}
				loadFieldsForIndex(idx);
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to load indexes'));
		}
	}

	async function loadFieldsForIndex(indexName: string) {
		fieldsLoading = true;
		try {
			const [fields, config, pref] = await Promise.all([
				getIndexFields({ indexName }),
				getIndexConfig(indexName),
				getPreference({ indexName })
			]);
			indexFields = fields;
			schemaFields = fields;
			fieldConfig = config;
			activeFields = pref.displayFields;

			const levelField = config.levelField;
			const savedFields = (
				pref.quickFilterFields.length > 0 ? pref.quickFilterFields : [levelField]
			).filter((f) => f !== levelField);
			quickFilterFields = [levelField, ...savedFields];
			search();
		} catch {
			indexFields = [];
			activeFields = [];
			quickFilterFields = [];
		} finally {
			fieldsLoading = false;
		}
	}

	function handleIndexChange(indexName: string) {
		stopLive();
		selectedIndex = indexName;
		if (browser) localStorage.setItem('logwiz:selectedIndex', indexName);
		navigateQuery({ index: indexName, filters: {} });
		aggregations = {};
		schemaFields = [];
		loadFieldsForIndex(indexName);
	}

	// --- Field change handlers ---

	let saveTimeout: ReturnType<typeof setTimeout>;
	function handleFieldsChange(fields: string[]) {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			if (selectedIndex) {
				saveDisplayFields({ indexName: selectedIndex, fields });
			}
		}, 500);
	}

	let quickFilterSaveTimeout: ReturnType<typeof setTimeout>;
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
		}
		clearTimeout(quickFilterSaveTimeout);
		quickFilterSaveTimeout = setTimeout(() => {
			if (selectedIndex) {
				saveQuickFilterFields({ indexName: selectedIndex, fields });
			}
			if (hasSearched) search();
		}, 500);
	}

	// --- Search ---

	async function search(append = false) {
		if (isLive) stopLive();
		if (selectedIndex === null) return;

		loading = true;

		if (!append) {
			lastSearchedParams = serialize(parsedQuery()).toString();
		}

		try {
			const queryText = getQueryText();
			const currentTimeRange = timeRange;
			const resolved = resolveTimeRange(currentTimeRange);
			const currentActiveFields = activeFields;

			if (!append) {
				fetchHistogram(resolved.startTs, resolved.endTs);
			}

			const result = await searchLogs({
				indexName: selectedIndex,
				query: queryText || '*',
				timeRange: (currentTimeRange.type === 'relative'
					? currentTimeRange.preset
					: '15m') as '15m',
				offset: append ? logs.length : 0,
				limit: BATCH_SIZE,
				startTimestamp: append ? searchStartTimestamp : resolved.startTs,
				endTimestamp: append ? searchEndTimestamp : resolved.endTs,
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
					saveQuickFilterFields({ indexName: selectedIndex, fields: quickFilterFields });
				}
			}

			if (!append && result.aggregations) {
				const hasActiveFiltersNow = Object.keys(activeFilters).length > 0;
				if (!hasActiveFiltersNow) {
					aggregations = result.aggregations;
				} else {
					const merged = { ...aggregations };
					for (const [field, values] of Object.entries(result.aggregations)) {
						if (!(field in merged)) {
							merged[field] = values;
						}
					}
					aggregations = merged;
				}
			}

			if (append) {
				const combined = [...logs, ...result.hits];
				logs = combined;
				updateColumnWidths(result.hits, currentActiveFields);
			} else {
				logs = result.hits;
				updateColumnWidths(result.hits, currentActiveFields, true);
				options?.onFreshSearch?.();
			}
			numHits = result.numHits;

			if (result.hits.length > 0) {
				const jsonNames = new Set(schemaFields.filter((f) => f.type === 'json').map((f) => f.name));
				if (jsonNames.size > 0) {
					const discovered = extractJsonSubFields(result.hits, jsonNames);
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
		} catch (e) {
			toast.error(getErrorMessage(e, 'Search failed'));
		} finally {
			loading = false;
		}
	}

	// --- Histogram ---

	async function fetchHistogram(startTs?: number, endTs?: number) {
		if (selectedIndex === null) return;

		const requestId = ++histogramRequestId;
		histogramLoading = true;
		try {
			const queryText = getQueryText();
			const currentTimeRange = timeRange;
			const result = await searchLogHistogram({
				indexName: selectedIndex,
				query: queryText || '*',
				timeRange: (currentTimeRange.type === 'relative'
					? currentTimeRange.preset
					: '15m') as '15m',
				startTimestamp: startTs,
				endTimestamp: endTs
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

	// --- Live mode ---

	function stopLive() {
		liveSessionId += 1;
		isLive = false;
		loading = false;
		newLiveLogs = 0;
		liveErrorShown = false;
		lastPollKeys = new Set();
		if (liveIntervalId !== null) {
			clearTimeout(liveIntervalId);
			liveIntervalId = null;
		}
	}

	function resetNewLiveLogs() {
		newLiveLogs = 0;
	}

	async function pollForNewLogs(sessionId: number) {
		if (!selectedIndex || !isActiveLiveSession(sessionId)) return;

		const endTs = Math.floor(Date.now() / 1000);
		// Use a strict forward-moving window so live mode starts from "now"
		const startTs = Math.max(0, lastPollTimestamp);

		if (startTs >= endTs) return;

		try {
			const queryText = getQueryText();
			const result = await pollLiveLogs({
				indexName: selectedIndex,
				query: queryText || '*',
				startTimestamp: startTs,
				endTimestamp: endTs,
				limit: 100
			});

			if (!isActiveLiveSession(sessionId)) return;

			// Deduplicate against previous poll's results (handles 1s overlap)
			const newHits = result.hits.filter(
				(hit: Record<string, unknown>) => !lastPollKeys.has(docKey(hit))
			);

			// Update dedup set for next cycle
			lastPollKeys = new Set(result.hits.map((hit: Record<string, unknown>) => docKey(hit)));

			if (newHits.length > 0) {
				logs = [...newHits, ...logs];
				numHits = numHits + newHits.length;
				newLiveLogs += newHits.length;
				updateColumnWidths(newHits, activeFields);
			}

			lastPollTimestamp = endTs;

			// Clear error state on successful poll
			if (liveErrorShown) {
				toast.success('Live mode reconnected');
				liveErrorShown = false;
			}
		} catch (e) {
			if (!isActiveLiveSession(sessionId)) return;
			if (!liveErrorShown) {
				toast.error(getErrorMessage(e, 'Live mode poll failed'));
				liveErrorShown = true;
			}
		}
	}

	async function schedulePoll(sessionId: number) {
		if (!isActiveLiveSession(sessionId)) return;
		await pollForNewLogs(sessionId);
		if (isActiveLiveSession(sessionId)) {
			liveIntervalId = setTimeout(() => {
				void schedulePoll(sessionId);
			}, 2000);
		}
	}

	async function startLive() {
		if (isLive || !selectedIndex) return;

		const sessionId = liveSessionId + 1;
		liveSessionId = sessionId;

		isLive = true;
		newLiveLogs = 0;
		liveErrorShown = false;
		lastPollKeys = new Set();

		const nowTs = Math.floor(Date.now() / 1000);
		lastPollTimestamp = nowTs;
		searchStartTimestamp = nowTs;
		searchEndTimestamp = nowTs;
		logs = [];
		numHits = 0;
		hasSearched = true;
		loading = false;
		updateColumnWidths([], activeFields, true);
		options?.onFreshSearch?.();

		if (isActiveLiveSession(sessionId)) {
			liveIntervalId = setTimeout(() => {
				void schedulePoll(sessionId);
			}, 2000);
		}
	}

	// --- Field value search ---

	async function searchFieldValuesHandler(field: string, searchTerm: string): Promise<string[]> {
		if (!selectedIndex) return [];
		const queryText = getQueryText();
		const currentTimeRange = timeRange;
		const result = await searchFieldValues({
			indexName: selectedIndex,
			field,
			searchTerm,
			query: queryText || '*',
			timeRange: (currentTimeRange.type === 'relative' ? currentTimeRange.preset : '15m') as '15m',
			startTimestamp: searchStartTimestamp,
			endTimestamp: searchEndTimestamp
		});
		if (result.unsupported) {
			toast.error(`Field "${field}" cannot be searched (not a fast field in Quickwit)`);
		}
		return result.values;
	}

	// --- Start loading immediately ---
	loadIndexes();

	// --- Setup auto-search effect (must be called in component context) ---

	function setupAutoSearch() {
		$effect(() => {
			const parsed = parsedQuery();
			const currentParams = serialize(parsed).toString();

			if (currentParams === lastSearchedParams) return;
			if (parsed.index === null) return;
			if (parsed.index !== selectedIndex) return;
			if (fieldsLoading) return;

			if (hasSearched || hasNonDefaultParams(parsed)) {
				lastSearchedParams = currentParams;
				search();
			}
		});

		$effect(() => {
			const fields = activeFields;
			untrack(() => {
				updateColumnWidths(logs, fields, true);
			});
		});

		// Cleanup live mode on unmount
		$effect(() => {
			return () => {
				stopLive();
			};
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
		get histogramData() {
			return histogramData;
		},
		get histogramLoading() {
			return histogramLoading;
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
		get activeFilters() {
			return activeFilters;
		},
		get panelAvailableFields() {
			return panelAvailableFields;
		},
		get quickFilterAvailableFields() {
			return quickFilterAvailableFields;
		},
		get isLive() {
			return isLive;
		},
		get newLiveLogs() {
			return newLiveLogs;
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
		startLive,
		stopLive,
		resetNewLiveLogs
	};
}
