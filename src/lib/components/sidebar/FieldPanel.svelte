<script lang="ts">
	import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import type { IndexField, QuickFilterBucket } from '$lib/types';
	import { severityDotColor, sortBySeverity } from '$lib/utils/log-helpers';
	import { parseClauses } from '$lib/utils/query';
	import { formatCountAsPercent } from '$lib/utils/quick-filter-percent';
	import ColumnDropdown from './ColumnDropdown.svelte';

	let {
		fields,
		activeFields = $bindable(),
		levelField,
		timestampField,
		messageField,
		levelAggregations = {},
		levelAggregationOverflow = {},
		numHits,
		query,
		onAddClause,
		onRemoveClause,
		hasClause,
		onClearClauses,
		onsearch,
		onFieldsChange,
		loading = false,
		indexId = null
	}: {
		fields: IndexField[];
		activeFields: string[];
		levelField: string;
		timestampField: string;
		messageField: string;
		levelAggregations: Record<string, QuickFilterBucket[]>;
		levelAggregationOverflow: Record<string, boolean>;
		numHits: number;
		query: string;
		onAddClause: (field: string, value: string, exclude?: boolean) => void;
		onRemoveClause: (field: string, value: string, exclude?: boolean) => void;
		hasClause: (field: string, value: string, exclude?: boolean) => boolean;
		onClearClauses: () => void;
		onsearch?: (
			field: string,
			searchTerm: string
		) => Promise<{ values: QuickFilterBucket[]; totalHits: number }>;
		onFieldsChange?: () => void;
		loading?: boolean;
		indexId?: string | null;
	} = $props();

	let clauses = $derived(parseClauses(query));

	let openSections = new SvelteSet<string>();
	let expandedAggregations = $state<Record<string, QuickFilterBucket[]>>({});
	let loadingSections = new SvelteSet<string>();

	let searchTerms = $state<Record<string, string>>({});
	let searchResults = $state<
		Record<string, { values: QuickFilterBucket[]; totalHits: number } | null>
	>({});
	let loadingSearch = new SvelteSet<string>();
	let expandedCounts = $state<Record<string, number>>({});
	let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	const INITIAL_SHOW_COUNT = 10;
	const PAGE_SIZE = 100;

	let activeFieldSet = $derived(new Set(activeFields));

	// --- localStorage persistence for open sections ---

	function loadSet(key: string): string[] {
		try {
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	}

	function saveOpenSections(id: string | null, sections: SvelteSet<string>) {
		if (!id) return;
		localStorage.setItem(`logwiz:openSections:${id}`, JSON.stringify([...sections]));
	}

	// Restore open sections from localStorage
	$effect(() => {
		openSections.clear();
		if (fields.length === 0) return;
		if (indexId) {
			const fieldSet = new Set(fields.map((f) => f.name));
			const savedOpen = loadSet(`logwiz:openSections:${indexId}`);
			for (const f of savedOpen) {
				if (fieldSet.has(f)) openSections.add(f);
			}
		}
		// Always open the level field by default
		if (levelField) openSections.add(levelField);
	});

	// Clean up debounce timers
	$effect(() => {
		return () => {
			for (const timer of Object.values(debounceTimers)) clearTimeout(timer);
		};
	});

	// Re-fetch expanded field aggregations when query or numHits changes
	// (query changes on filter toggle, numHits changes on new search results)
	let prevRefreshKey = '';
	$effect(() => {
		const key = `${query}\0${numHits}`;
		if (prevRefreshKey && key !== prevRefreshKey) {
			refreshExpandedFields();
		}
		prevRefreshKey = key;
	});

	function refreshExpandedFields() {
		if (!onsearch) return;
		const fieldsToRefresh = [...openSections].filter((f) => f !== levelField);
		Promise.allSettled(
			fieldsToRefresh.map((fieldName) =>
				onsearch!(fieldName, searchTerms[fieldName]?.trim() || '').then((result) => {
					expandedAggregations = { ...expandedAggregations, [fieldName]: result.values };
				})
			)
		);
	}

	// --- Field sorting: level field first, then fast fields, then non-fast ---

	let fastFields = $derived.by(() => {
		const level: IndexField[] = [];
		const rest: IndexField[] = [];
		for (const f of fields) {
			if (!f.fast) continue;
			if (f.name === levelField) level.push(f);
			else rest.push(f);
		}
		return [...level, ...rest];
	});

	let nonFastFields = $derived(fields.filter((f) => !f.fast));
	let nonFastCollapsed = $state(true);

	// --- Expand/collapse ---

	async function toggleSection(field: IndexField) {
		if (!field.fast) return;
		if (openSections.has(field.name)) {
			openSections.delete(field.name);
		} else {
			openSections.add(field.name);
			// Lazy-load aggregations if not the level field and not already loaded
			if (field.name !== levelField && !expandedAggregations[field.name] && onsearch) {
				loadingSections.add(field.name);
				try {
					const result = await onsearch(field.name, '');
					expandedAggregations = {
						...expandedAggregations,
						[field.name]: result.values
					};
				} catch {
					// Leave empty on error
				} finally {
					loadingSections.delete(field.name);
				}
			}
		}
		saveOpenSections(indexId, openSections);
	}

	// --- Aggregation data access ---

	function getAggregations(field: string): QuickFilterBucket[] {
		if (field === levelField) {
			return levelAggregations[field] ?? [];
		}
		return expandedAggregations[field] ?? [];
	}

	function getOverflow(field: string): boolean {
		if (field === levelField) {
			return levelAggregationOverflow[field] ?? false;
		}
		return false;
	}

	function getDenominator(field: string): number {
		return searchResults[field]?.totalHits ?? numHits;
	}

	// --- Display values (same logic as old QuickFilterPanel) ---

	function getActiveValues(field: string): string[] {
		const seen = new Set<string>();
		const active: string[] = [];
		for (const c of clauses) {
			if (c.field === field && !c.exclude && !seen.has(c.value)) {
				seen.add(c.value);
				active.push(c.value);
			}
		}
		return active;
	}

	function getGhostValues(field: string): string[] {
		const valueSet = new Set(getAggregations(field).map((b) => b.value));
		return getActiveValues(field).filter((v) => !valueSet.has(v));
	}

	function getTotalValueCount(field: string): number {
		return getAggregations(field).length + getGhostValues(field).length;
	}

	function getDisplayValues(field: string): QuickFilterBucket[] {
		const searched = searchResults[field];
		if (searched !== null && searched !== undefined) {
			return searched.values;
		}
		const active = getActiveValues(field);
		const activeSet = new Set(active);
		const aggBuckets = getAggregations(field);
		const aggValueMap = new Map(aggBuckets.map((b) => [b.value, b]));
		const activeBuckets: QuickFilterBucket[] = active.map(
			(value) => aggValueMap.get(value) ?? { value, count: null }
		);
		const remainingBuckets = aggBuckets.filter((b) => !activeSet.has(b.value));
		const limit = expandedCounts[field] ?? INITIAL_SHOW_COUNT;
		return [...activeBuckets, ...remainingBuckets.slice(0, limit)];
	}

	function getAggregationRemaining(field: string): number {
		const activeSet = new Set(getActiveValues(field));
		const total = getAggregations(field).filter((b) => !activeSet.has(b.value)).length;
		const shown = expandedCounts[field] ?? INITIAL_SHOW_COUNT;
		return Math.max(0, total - shown);
	}

	function sortBucketsBySeverity(buckets: QuickFilterBucket[]): QuickFilterBucket[] {
		const sortedValues = sortBySeverity(buckets.map((b) => b.value));
		const byValue = new Map(buckets.map((b) => [b.value, b]));
		return sortedValues.map((v) => byValue.get(v) ?? { value: v, count: null });
	}

	// --- Search within expanded field ---

	function handleSearchInput(field: string, value: string) {
		searchTerms = { ...searchTerms, [field]: value };
		clearTimeout(debounceTimers[field]);

		if (!value.trim()) {
			searchResults = { ...searchResults, [field]: null };
			loadingSearch.delete(field);
			return;
		}

		loadingSearch.add(field);
		debounceTimers[field] = setTimeout(async () => {
			const currentTerm = searchTerms[field];
			if (!currentTerm?.trim() || !onsearch) {
				loadingSearch.delete(field);
				return;
			}
			try {
				const result = await onsearch(field, currentTerm.trim());
				if (searchTerms[field] === currentTerm) {
					searchResults = { ...searchResults, [field]: result };
				}
			} catch {
				if (searchTerms[field] === currentTerm) {
					searchResults = { ...searchResults, [field]: null };
				}
			} finally {
				loadingSearch.delete(field);
			}
		}, 300);
	}

	// --- Filter toggling ---

	function toggleValue(field: string, value: string) {
		if (hasClause(field, value)) {
			onRemoveClause(field, value);
		} else {
			onAddClause(field, value);
		}
	}

	function isChecked(field: string, value: string): boolean {
		return hasClause(field, value);
	}

	function hasActiveClausesForField(field: string): boolean {
		return clauses.some((c) => c.field === field && !c.exclude);
	}

	// --- Column toggling ---

	function toggleColumn(fieldName: string) {
		if (activeFieldSet.has(fieldName)) {
			activeFields = activeFields.filter((f) => f !== fieldName);
		} else {
			activeFields = [...activeFields, fieldName];
		}
		onFieldsChange?.();
	}

	// --- Filter state ---

	let hasAnyFilters = $derived(clauses.length > 0);
</script>

<div class="flex flex-col bg-base-100">
	<!-- Panel header -->
	<div class="flex items-center border-b border-base-300 px-3 py-2">
		<h3
			class="flex-1 text-left text-xs font-semibold tracking-wider text-base-content/80 uppercase"
		>
			Fields
		</h3>
		{#if hasAnyFilters}
			<button
				class="btn mr-1 p-0 btn-ghost btn-xs"
				onclick={() => onClearClauses()}
				title="Clear all filters"
			>
				<span class="text-[10px] text-primary">Clear</span>
			</button>
		{/if}
		<ColumnDropdown
			bind:activeFields
			pinnedFields={[timestampField, levelField]}
			pinnedFieldsEnd={[messageField]}
			onchange={onFieldsChange}
		/>
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center py-4">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else if fields.length === 0}
		<div class="px-3 py-2">
			<p class="text-[11px] text-base-content/50">No fields available</p>
		</div>
	{:else}
		<div class="flex flex-col">
			<!-- Fast fields (expandable with filter values) -->
			{#each fastFields as field (field.name)}
				{@const isLevel = field.name === levelField}
				{@const isOpen = openSections.has(field.name)}
				{@const isColumn = activeFieldSet.has(field.name)}

				<div class="border-b border-base-300/50">
					<!-- Field row -->
					<div class="flex w-full items-center px-3 py-1.5">
						<button
							class="flex min-w-0 flex-1 items-center"
							onclick={() => toggleSection(field)}
						>
							{#if isOpen}
								<ChevronDown size={12} class="mr-1 shrink-0 text-base-content/60" />
							{:else}
								<ChevronRight size={12} class="mr-1 shrink-0 text-base-content/60" />
							{/if}
							<span
								class="min-w-0 flex-1 truncate text-left text-xs font-medium text-base-content"
								title={field.name}
							>
								{field.name}
							</span>
						</button>

						<button
							class="btn btn-ghost p-0 btn-xs"
							onclick={() => toggleColumn(field.name)}
							title={isColumn ? 'Remove from view' : 'Add to view'}
						>
	{#if isColumn}
								<Eye size={12} class="text-base-content" />
							{:else}
								<EyeOff size={12} class="text-base-content/80" />
							{/if}
						</button>
					</div>

					<!-- Expanded filter values -->
					{#if isOpen}
						<div class="px-3 pb-3">
							{#if loadingSections.has(field.name)}
								<div class="flex items-center gap-2 py-1">
									<span class="loading loading-xs loading-spinner"></span>
									<span class="text-xs text-base-content/50">Loading...</span>
								</div>
							{:else if getTotalValueCount(field.name) > INITIAL_SHOW_COUNT}
								<input
									type="text"
									class="input input-xs mb-2 w-full border-base-300 bg-base-200/50"
									placeholder="Search values..."
									value={searchTerms[field.name] ?? ''}
									oninput={(e) => handleSearchInput(field.name, e.currentTarget.value)}
								/>
							{/if}

							{#if loadingSearch.has(field.name)}
								<div class="flex items-center gap-2 py-1">
									<span class="loading loading-xs loading-spinner"></span>
									<span class="text-xs text-base-content/50">Searching...</span>
								</div>
							{:else if !loadingSections.has(field.name) && getDisplayValues(field.name).length === 0}
								<p class="py-1 text-xs text-base-content/50">
									{searchTerms[field.name]?.trim()
										? 'No matching values'
										: 'No values found'}
								</p>
							{:else if !loadingSections.has(field.name)}
								<div class="flex flex-col gap-1">
									{#each isLevel ? sortBucketsBySeverity(getDisplayValues(field.name)) : getDisplayValues(field.name) as bucket (bucket.value)}
										{#if isLevel}
											{@const dotColor = severityDotColor(bucket.value.toLowerCase())}
											{@const isActive = isChecked(field.name, bucket.value)}
											{@const anyActive = hasActiveClausesForField(field.name)}
											{@const showFull = !anyActive || isActive}
											<button
												class="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 text-xs transition-colors duration-150 hover:bg-base-200"
												role="checkbox"
												aria-checked={isActive}
												onclick={() => toggleValue(field.name, bucket.value)}
											>
												<span
													class="h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-150 {showFull
														? (dotColor ?? 'bg-base-content/40')
														: 'bg-base-content/20'}"
												></span>
												<span
													class="min-w-0 flex-1 truncate text-left transition-colors duration-150 {showFull
														? ''
														: 'text-base-content/40'}">{bucket.value}</span
												>
												<span
													class="w-10 shrink-0 text-right text-[10px] tabular-nums text-base-content/50"
												>
													{formatCountAsPercent(bucket.count, getDenominator(field.name))}
												</span>
											</button>
										{:else}
											<label
												class="flex cursor-pointer items-center gap-2 rounded px-1.5 text-xs hover:bg-base-200"
											>
												<input
													type="checkbox"
													class="checkbox checkbox-xs"
													checked={isChecked(field.name, bucket.value)}
													onclick={(e) => {
														e.preventDefault();
														toggleValue(field.name, bucket.value);
													}}
												/>
												<span class="min-w-0 flex-1 truncate">{bucket.value}</span>
												<span
													class="w-10 shrink-0 text-right text-[10px] tabular-nums text-base-content/50"
												>
													{formatCountAsPercent(bucket.count, getDenominator(field.name))}
												</span>
											</label>
										{/if}
									{/each}
								</div>

								{#if !searchTerms[field.name]?.trim() && getAggregationRemaining(field.name) > 0}
									<button
										class="mt-1 text-xs text-primary hover:underline"
										onclick={() => {
											expandedCounts = {
												...expandedCounts,
												[field.name]:
													(expandedCounts[field.name] ?? INITIAL_SHOW_COUNT) + PAGE_SIZE
											};
										}}
									>
										Show more ({getAggregationRemaining(field.name)} remaining)
									</button>
								{:else if !searchTerms[field.name]?.trim() && (expandedCounts[field.name] ?? INITIAL_SHOW_COUNT) > INITIAL_SHOW_COUNT && getTotalValueCount(field.name) > INITIAL_SHOW_COUNT}
									<button
										class="mt-1 text-xs text-primary hover:underline"
										onclick={() => {
											const { [field.name]: _, ...rest } = expandedCounts;
											expandedCounts = rest;
										}}
									>
										Show less
									</button>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			<!-- Non-fast fields (collapsible section, view toggle only) -->
			{#if nonFastFields.length > 0}
				<div class="border-b border-base-300/50">
					<button
						class="flex w-full items-center px-3 py-1.5"
						onclick={() => (nonFastCollapsed = !nonFastCollapsed)}
					>
						{#if nonFastCollapsed}
							<ChevronRight size={12} class="mr-1 shrink-0 text-base-content/60" />
						{:else}
							<ChevronDown size={12} class="mr-1 shrink-0 text-base-content/60" />
						{/if}
						<span class="text-xs font-medium text-base-content/60">
							Other Fields
						</span>
						<span class="ml-1 text-[10px] text-base-content/40">
							({nonFastFields.length})
						</span>
					</button>
				</div>

				{#if !nonFastCollapsed}
					{#each nonFastFields as field (field.name)}
						{@const isColumn = activeFieldSet.has(field.name)}
						<div class="border-b border-base-300/50">
							<div class="flex w-full items-center px-3 py-1.5 pl-7">
								<span
									class="min-w-0 flex-1 truncate text-xs text-base-content/70"
									title={field.name}
								>
									{field.name}
								</span>
								<button
									class="btn btn-ghost p-0 btn-xs"
									onclick={() => toggleColumn(field.name)}
									title={isColumn ? 'Remove from view' : 'Add to view'}
								>
									{#if isColumn}
										<Eye size={12} class="text-primary" />
									{:else}
										<EyeOff size={12} class="text-base-content/60" />
									{/if}
								</button>
							</div>
						</div>
					{/each}
				{/if}
			{/if}
		</div>
	{/if}
</div>
