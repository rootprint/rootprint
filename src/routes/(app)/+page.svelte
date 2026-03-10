<script lang="ts">
	import { getIndexes, getIndexFields, getIndexConfig } from '$lib/api/indexes.remote';
	import { searchLogs, searchFieldValues, searchLogHistogram } from '$lib/api/logs.remote';
	import {
		getPreference,
		saveDisplayFields,
		saveQuickFilterFields
	} from '$lib/api/preferences.remote';
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { getNestedValue, formatFieldValue } from '$lib/utils/format';
	import { combineQueryWithFilters } from '$lib/utils/query';
	import { buildQueryUrl, serialize, hasNonDefaultParams } from '$lib/utils/query-params';
	import type { ParsedQuery } from '$lib/utils/query-params';
	import { resolveTimeRange } from '$lib/utils/time';
	import { computeColumnWidths } from '$lib/utils/column-width';
	import { extractJsonSubFields } from '$lib/utils/fields';
	import type { TimeRange, IndexField } from '$lib/types';
	import TimeRangePicker from '$lib/components/TimeRangePicker.svelte';
	import LogRow from '$lib/components/LogRow.svelte';
	import FieldPanel from '$lib/components/FieldPanel.svelte';
	import QuickFilterPanel from '$lib/components/QuickFilterPanel.svelte';
	import Icon from '@iconify/svelte';
	import LogDetailDrawer from '$lib/components/LogDetailDrawer.svelte';
	import LogFrequencyChart from '$lib/components/LogFrequencyChart.svelte';

	let { data } = $props();

	let indexes = $state<{ indexId: string; indexUri: string }[]>([]);
	let selectedIndex = $state<string | null>(null);
	let queryInput = $state(data.parsedQuery.query);
	let timeRange = $derived(data.parsedQuery.timeRange);
	let timezoneMode = $derived(data.parsedQuery.timezoneMode);
	let quickFilterFields = $state<string[]>([]);
	let activeFilters = $derived(data.parsedQuery.filters);
	let aggregations = $state<Record<string, string[]>>({});
	let urlIndex = $derived(data.parsedQuery.index);
	let queryText = $derived(combineQueryWithFilters(queryInput, activeFilters));
	let logs = $state<Record<string, unknown>[]>([]);
	let numHits = $state(0);
	let loading = $state(false);
	let errorMessage = $state('');
	let hasSearched = $state(false);
	let searchStartTimestamp = $state<number | undefined>(undefined);
	let searchEndTimestamp = $state<number | undefined>(undefined);
	let wrapMode = $state<'none' | 'wrap' | 'pretty'>('none');
	let copied = $state(false);
	let selectedLog = $state<Record<string, unknown> | null>(null);
	let drawerOpen = $state(false);
	let histogramData = $state<{ timestamp: number; levels: Record<string, number> }[]>([]);
	let histogramLoading = $state(false);
	let chartCollapsed = $state(
		browser ? localStorage.getItem('logwiz:chartCollapsed') === 'true' : false
	);

	function shareQuery() {
		navigator.clipboard.writeText(window.location.href);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	let fieldConfig = $state({
		levelField: 'level',
		timestampField: 'timestamp',
		messageField: 'message'
	});

	let indexFields = $state<IndexField[]>([]);
	let schemaFields = $state<IndexField[]>([]);
	let activeFields = $state<string[]>([]);
	let fieldsLoading = $state(false);

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

	let extraFieldNames = $derived(activeFields);

	let _maxRawWidths: Record<string, number> = {};
	let columnWidths = $state<Record<string, number>>({});

	function updateColumnWidths(newLogs: Record<string, unknown>[], fields: string[], reset = false) {
		if (reset) _maxRawWidths = {};
		const result = computeColumnWidths(newLogs, fields, _maxRawWidths);
		_maxRawWidths = result.maxRawWidths;
		columnWidths = result.widths;
	}

	$effect(() => {
		const fields = extraFieldNames;
		untrack(() => {
			updateColumnWidths(logs, fields, true);
		});
	});

	afterNavigate(() => {
		queryInput = data.parsedQuery.query;
	});

	let lastSearchedParams = $state('');

	$effect(() => {
		const parsed = data.parsedQuery;
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

	function navigateQuery(partial: Partial<ParsedQuery>, push = false) {
		const url = buildQueryUrl(page.url.searchParams, partial);
		goto(url, {
			replaceState: !push,
			keepFocus: true,
			noScroll: true
		});
	}

	let scrollElement = $state<HTMLDivElement | null>(null);

	const BATCH_SIZE = 50;

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
			errorMessage = e instanceof Error ? e.message : 'Failed to load indexes';
		}
	}

	loadIndexes();

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
		selectedIndex = indexName;
		if (browser) localStorage.setItem('logwiz:selectedIndex', indexName);
		navigateQuery({ index: indexName, filters: {} });
		aggregations = {};
		schemaFields = [];
		loadFieldsForIndex(indexName);
	}

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

	async function search(append = false) {
		if (selectedIndex === null) return;

		loading = true;
		errorMessage = '';

		if (!append) {
			lastSearchedParams = serialize(data.parsedQuery).toString();
		}

		try {
			const resolved = resolveTimeRange(timeRange);

			if (!append) {
				fetchHistogram(resolved.startTs, resolved.endTs);
			}

			const result = await searchLogs({
				indexName: selectedIndex,
				query: queryText || '*',
				timeRange: (timeRange.type === 'relative' ? timeRange.preset : '15m') as '15m',
				offset: append ? logs.length : 0,
				limit: BATCH_SIZE,
				startTimestamp: append ? searchStartTimestamp : resolved.startTs,
				endTimestamp: append ? searchEndTimestamp : resolved.endTs,
				quickFilterFields
			});

			searchStartTimestamp = result.startTimestamp;
			searchEndTimestamp = result.endTimestamp;

			if (!append && result.aggregations) {
				const hasActiveFilters = Object.keys(activeFilters).length > 0;
				if (!hasActiveFilters) {
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
				logs = [...logs, ...result.hits];
				updateColumnWidths(result.hits, extraFieldNames);
			} else {
				logs = result.hits;
				updateColumnWidths(result.hits, extraFieldNames, true);
				scrollElement?.scrollTo(0, 0);
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
			errorMessage = e instanceof Error ? e.message : 'Search failed';
		} finally {
			loading = false;
		}
	}

	let histogramRequestId = 0;

	async function fetchHistogram(startTs?: number, endTs?: number) {
		if (selectedIndex === null) return;

		const requestId = ++histogramRequestId;
		histogramLoading = true;
		try {
			const result = await searchLogHistogram({
				indexName: selectedIndex,
				query: queryText || '*',
				timeRange: (timeRange.type === 'relative' ? timeRange.preset : '15m') as '15m',
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

	function handleChartToggle() {
		chartCollapsed = !chartCollapsed;
		if (browser) {
			localStorage.setItem('logwiz:chartCollapsed', String(chartCollapsed));
		}
	}

	function handleBrush(start: number, end: number) {
		navigateQuery({ timeRange: { type: 'absolute', start, end } });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			navigateQuery({ query: queryInput }, true);
		}
	}

	function handleTimeRangeChange(range: TimeRange) {
		navigateQuery({ timeRange: range });
	}

	function handleFilterChange(filters: Record<string, string[]>) {
		navigateQuery({ filters });
	}

	async function handleFieldValueSearch(field: string, searchTerm: string): Promise<string[]> {
		if (!selectedIndex) return [];
		const result = await searchFieldValues({
			indexName: selectedIndex,
			field,
			searchTerm,
			query: queryText || '*',
			timeRange: (timeRange.type === 'relative' ? timeRange.preset : '15m') as '15m',
			startTimestamp: searchStartTimestamp,
			endTimestamp: searchEndTimestamp
		});
		return result.values;
	}

	function handleScroll() {
		if (!scrollElement) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollElement;
		if (scrollHeight - scrollTop - clientHeight < 300 && !loading && logs.length < numHits) {
			search(true);
		}
	}
</script>

<LogDetailDrawer
	bind:open={drawerOpen}
	hit={selectedLog}
	timestampField={fieldConfig.timestampField}
	onfilter={(key, value, exclude) => {
		const clause = exclude ? `NOT ${key}:${value}` : `${key}:${value}`;
		queryInput = queryInput ? `${queryInput} AND ${clause}` : clause;
		navigateQuery({ query: queryInput }, true);
	}}
>
	<div class="flex h-full w-full">
		<div
			class="flex h-full w-56 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-base-300 bg-base-100"
		>
			<QuickFilterPanel
				fields={quickFilterFields}
				{aggregations}
				{activeFilters}
				onfilter={handleFilterChange}
				availableFields={quickFilterAvailableFields}
				onconfigchange={handleQuickFilterFieldsChange}
				onsearch={handleFieldValueSearch}
				pinnedFields={[fieldConfig.levelField]}
			/>
			<FieldPanel
				availableFields={panelAvailableFields}
				bind:activeFields
				onchange={handleFieldsChange}
				loading={fieldsLoading}
			/>
		</div>

		<div class="flex min-w-0 flex-1 flex-col">
			<div class="border-b border-base-300 bg-base-100 px-4 py-3">
				<div class="flex w-full items-center gap-2">
					<select
						class="select-bordered select w-48 select-sm"
						value={selectedIndex}
						onchange={(e) => handleIndexChange(e.currentTarget.value)}
					>
						{#each indexes as idx (idx.indexId)}
							<option value={idx.indexId}>{idx.indexId}</option>
						{/each}
					</select>

					<div class="join">
						{#each [['none', 'No wrap'], ['wrap', 'Wrap'], ['pretty', 'Pretty']] as [mode, label] (mode)}
							<button
								class="btn join-item btn-sm whitespace-nowrap {wrapMode === mode ? 'btn-accent' : ''}"
								onclick={() => (wrapMode = mode as typeof wrapMode)}
							>
								{label}
							</button>
						{/each}
					</div>

					<button class="btn ml-auto btn-sm" onclick={shareQuery}>
						<Icon icon="lucide:share-2" width="14" height="14" />
						{copied ? 'Copied!' : 'Share'}
					</button>

					<TimeRangePicker
						value={timeRange}
						{timezoneMode}
						onchange={handleTimeRangeChange}
						ontimezonechange={(mode) => navigateQuery({ timezoneMode: mode })}
					/>

					<button
						class="btn btn-sm btn-accent"
						onclick={() => navigateQuery({ query: queryInput }, true)}
						disabled={loading || !selectedIndex}
					>
						<Icon icon="lucide:play" width="14" height="14" />
						{loading && !logs.length ? 'Running...' : 'Run query'}
					</button>
				</div>

				<div class="mt-2 flex w-full items-center gap-2">
					<input
						type="text"
						class="input-bordered input input-sm min-w-0 flex-1"
						placeholder="Lucene query (e.g. level:error AND service:api)"
						bind:value={queryInput}
						onkeydown={handleKeydown}
					/>
					{#if hasSearched}
						<span class="text-xs whitespace-nowrap text-base-content/50"
							>{numHits.toLocaleString()} hits</span
						>
					{/if}
				</div>
			</div>

			{#if hasSearched}
				<LogFrequencyChart
					data={histogramData}
					{timezoneMode}
					loading={histogramLoading}
					collapsed={chartCollapsed}
					ontoggle={handleChartToggle}
					onbrush={handleBrush}
				/>
			{/if}

			<div
				bind:this={scrollElement}
				class="min-h-0 flex-1 overflow-auto bg-base-200/30"
				onscroll={handleScroll}
			>
				{#if errorMessage}
					<div class="p-4">
						<div class="alert text-sm alert-error">{errorMessage}</div>
					</div>
				{:else if !hasSearched}
					<div class="flex h-full items-center justify-center">
						<span class="loading loading-sm loading-spinner"></span>
					</div>
				{:else if logs.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-base-content/40">No logs found</p>
					</div>
				{:else}
					<div class="w-fit min-w-full">
						{#each logs as hit, i (i)}
							<LogRow
								{hit}
								{wrapMode}
								{timezoneMode}
								levelField={fieldConfig.levelField}
								timestampField={fieldConfig.timestampField}
								messageField={fieldConfig.messageField}
								extraFields={extraFieldNames}
								{columnWidths}
								onclick={() => {
									selectedLog = hit;
									drawerOpen = true;
								}}
							/>
						{/each}
						{#if loading}
							<div class="flex justify-center py-4">
								<span class="loading loading-sm loading-spinner"></span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</LogDetailDrawer>
