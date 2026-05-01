<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';

	import { QUICKWIT_AGG_MAX } from '$lib/constants/ingest';
	import { storageKeys } from '$lib/constants/storage-keys';
	import type { IndexField, QuickFilterBucket } from '$lib/types';
	import { isOtelAttr, isOtelResourceAttr, otelDisplayName } from '$lib/utils/fields';
	import { severityDotColor, sortBySeverity } from '$lib/utils/log-helpers';
	import { parseClauses } from '$lib/utils/query';
	import { formatCountAsPercent } from '$lib/utils/quick-filter-percent';

	let {
		fields,
		levelField,
		levelAggregations = {},
		numHits,
		query,
		onAddClause,
		onRemoveClause,
		hasClause,
		onClearClauses,
		onsearch,
		loading = false,
		indexId = null,
		isOtelIndex = false
	}: {
		fields: IndexField[];
		levelField: string;
		levelAggregations: Record<string, QuickFilterBucket[]>;
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
		loading?: boolean;
		indexId?: string | null;
		isOtelIndex?: boolean;
	} = $props();

	const INITIAL_SHOW_COUNT = 10;
	const PAGE_SIZE = 100;

	let clauses = $derived(parseClauses(query));
	let hasAnyFilters = $derived(clauses.length > 0);

	type SearchResult = { values: QuickFilterBucket[]; totalHits: number };
	type FieldState = {
		aggregations: QuickFilterBucket[] | null;
		searchTerm: string;
		searchResult: SearchResult | null;
		showCount: number;
		loadingAggregations: boolean;
		loadingSearch: boolean;
	};

	let openSections = new SvelteSet<string>();
	let collapsedGroups = new SvelteSet<string>();
	let nonFastCollapsed = $state(true);
	let fieldStates = $state<Record<string, FieldState>>({});

	let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	let prevRefreshKey = '';

	function fieldState(name: string): FieldState {
		const existing = fieldStates[name];
		if (existing) return existing;
		const created: FieldState = {
			aggregations: null,
			searchTerm: '',
			searchResult: null,
			showCount: INITIAL_SHOW_COUNT,
			loadingAggregations: false,
			loadingSearch: false
		};
		fieldStates[name] = created;
		return created;
	}

	function loadSet(key: string): string[] {
		try {
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	}

	function saveSet(key: string, set: SvelteSet<string>) {
		localStorage.setItem(key, JSON.stringify([...set]));
	}

	$effect(() => {
		void indexId;
		for (const timer of Object.values(debounceTimers)) clearTimeout(timer);
		debounceTimers = {};
		fieldStates = {};
		prevRefreshKey = '';
	});

	$effect(() => {
		openSections.clear();
		if (fields.length === 0) return;
		if (indexId) {
			const fieldSet = new Set(fields.map((f) => f.name));
			for (const name of loadSet(storageKeys.openSections(indexId))) {
				if (fieldSet.has(name)) openSections.add(name);
			}
		}
		if (levelField) openSections.add(levelField);
	});

	$effect(() => {
		collapsedGroups.clear();
		if (indexId) {
			for (const g of loadSet(storageKeys.collapsedGroups(indexId))) {
				collapsedGroups.add(g);
			}
		}
	});

	$effect(() => {
		return () => {
			for (const timer of Object.values(debounceTimers)) clearTimeout(timer);
		};
	});

	$effect(() => {
		const key = `${query}\0${numHits}`;
		if (prevRefreshKey && key !== prevRefreshKey) {
			refreshExpandedFields();
		}
		prevRefreshKey = key;
	});

	function refreshExpandedFields() {
		if (!onsearch) return;
		const search = onsearch;
		const fieldsToRefresh = [...openSections].filter((f) => f !== levelField);
		Promise.allSettled(
			fieldsToRefresh.map((name) =>
				search(name, fieldStates[name]?.searchTerm.trim() ?? '').then((result) => {
					fieldState(name).aggregations = result.values;
				})
			)
		);
	}

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

	type FieldGroup = {
		key: string;
		label: string;
		fields: IndexField[];
		indented: boolean;
	};

	let fastGroups = $derived.by<FieldGroup[]>(() => {
		if (!isOtelIndex) {
			return [{ key: 'all', label: '', fields: fastFields, indented: false }];
		}
		const top: IndexField[] = [];
		const attrs: IndexField[] = [];
		const resourceAttrs: IndexField[] = [];
		for (const f of fastFields) {
			if (isOtelResourceAttr(f.name)) resourceAttrs.push(f);
			else if (isOtelAttr(f.name)) attrs.push(f);
			else top.push(f);
		}
		return [
			{ key: 'top', label: '', fields: top, indented: false },
			{ key: 'attributes', label: 'Attributes', fields: attrs, indented: true },
			{
				key: 'resource_attributes',
				label: 'Resource Attributes',
				fields: resourceAttrs,
				indented: true
			}
		];
	});

	function toggleGroup(group: string) {
		if (collapsedGroups.has(group)) collapsedGroups.delete(group);
		else collapsedGroups.add(group);
		if (indexId) saveSet(storageKeys.collapsedGroups(indexId), collapsedGroups);
	}

	async function toggleSection(field: IndexField) {
		if (!field.fast) return;
		const name = field.name;
		if (openSections.has(name)) {
			openSections.delete(name);
		} else {
			openSections.add(name);
			if (name !== levelField && !fieldStates[name]?.aggregations && onsearch) {
				fieldState(name).loadingAggregations = true;
				try {
					const result = await onsearch(name, '');
					fieldState(name).aggregations = result.values;
				} catch {
					// Leave empty on error
				} finally {
					if (fieldStates[name]) fieldStates[name].loadingAggregations = false;
				}
			}
		}
		if (indexId) saveSet(storageKeys.openSections(indexId), openSections);
	}

	function getAggregations(name: string): QuickFilterBucket[] {
		if (name === levelField) return levelAggregations[name] ?? [];
		return fieldStates[name]?.aggregations ?? [];
	}

	function getDenominator(name: string): number {
		return fieldStates[name]?.searchResult?.totalHits ?? numHits;
	}

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

	function getDisplayValues(name: string): QuickFilterBucket[] {
		const s = fieldStates[name];
		if (s?.searchResult) return s.searchResult.values;

		const active = getActiveValues(name);
		const activeSet = new Set(active);
		const aggBuckets = getAggregations(name);
		const aggValueMap = new Map(aggBuckets.map((b) => [b.value, b]));
		const activeBuckets: QuickFilterBucket[] = active.map(
			(value) => aggValueMap.get(value) ?? { value, count: null }
		);
		const remainingBuckets = aggBuckets.filter((b) => !activeSet.has(b.value));
		const limit = s?.showCount ?? INITIAL_SHOW_COUNT;
		return [...activeBuckets, ...remainingBuckets.slice(0, limit)];
	}

	function getAggregationRemaining(name: string): number {
		const activeSet = new Set(getActiveValues(name));
		const total = getAggregations(name).filter((b) => !activeSet.has(b.value)).length;
		const shown = fieldStates[name]?.showCount ?? INITIAL_SHOW_COUNT;
		return Math.max(0, total - shown);
	}

	function sortBucketsBySeverity(buckets: QuickFilterBucket[]): QuickFilterBucket[] {
		const sortedValues = sortBySeverity(buckets.map((b) => b.value));
		const byValue = new Map(buckets.map((b) => [b.value, b]));
		return sortedValues.map((v) => byValue.get(v) ?? { value: v, count: null });
	}

	function handleSearchInput(name: string, value: string) {
		const s = fieldState(name);
		s.searchTerm = value;
		clearTimeout(debounceTimers[name]);

		if (!value.trim()) {
			s.searchResult = null;
			s.loadingSearch = false;
			return;
		}

		s.loadingSearch = true;
		debounceTimers[name] = setTimeout(async () => {
			const currentTerm = fieldStates[name]?.searchTerm;
			if (!currentTerm?.trim() || !onsearch) {
				if (fieldStates[name]) fieldStates[name].loadingSearch = false;
				return;
			}
			try {
				const result = await onsearch(name, currentTerm.trim());
				const live = fieldStates[name];
				if (live && live.searchTerm === currentTerm) live.searchResult = result;
			} catch {
				const live = fieldStates[name];
				if (live && live.searchTerm === currentTerm) live.searchResult = null;
			} finally {
				if (fieldStates[name]) fieldStates[name].loadingSearch = false;
			}
		}, 300);
	}

	function toggleValue(field: string, value: string) {
		if (hasClause(field, value)) onRemoveClause(field, value);
		else onAddClause(field, value);
	}

	function hasActiveClausesForField(field: string): boolean {
		return clauses.some((c) => c.field === field && !c.exclude);
	}

	function displayName(field: IndexField): string {
		return isOtelIndex ? otelDisplayName(field.name) : field.name;
	}

	function getFieldCountLabel(name: string): string {
		const count = (levelAggregations[name] ?? fieldStates[name]?.aggregations ?? []).length;
		if (count === 0) return '';
		if (count >= QUICKWIT_AGG_MAX) return `${QUICKWIT_AGG_MAX}+`;
		return String(count);
	}
</script>

{#snippet fieldValues(field: IndexField, isLevel: boolean, indented: boolean = false)}
	{@const name = field.name}
	{@const state = fieldStates[name]}
	{@const isLoading = state?.loadingAggregations ?? false}
	{@const isSearching = state?.loadingSearch ?? false}
	{@const searchTerm = state?.searchTerm.trim() ?? ''}
	{@const displayValues = getDisplayValues(name)}
	{@const totalValues = getTotalValueCount(name)}
	{@const remaining = getAggregationRemaining(name)}
	{@const denominator = getDenominator(name)}
	{@const shown = state?.showCount ?? INITIAL_SHOW_COUNT}
	{@const anyActiveForField = hasActiveClausesForField(name)}

	<div class="{indented ? 'pr-3 pl-6' : 'px-3'} pb-3">
		{#if isLoading}
			<div class="flex items-center gap-2 py-1">
				<span class="loading loading-xs loading-spinner"></span>
				<span class="text-xs text-base-content/50">Loading...</span>
			</div>
		{:else if totalValues > INITIAL_SHOW_COUNT}
			<input
				type="text"
				class="input input-xs mb-2 w-full border-base-300 bg-base-200/50"
				placeholder="Search values..."
				value={state?.searchTerm ?? ''}
				oninput={(e) => handleSearchInput(name, e.currentTarget.value)}
			/>
		{/if}

		{#if isSearching}
			<div class="flex items-center gap-2 py-1">
				<span class="loading loading-xs loading-spinner"></span>
				<span class="text-xs text-base-content/50">Searching...</span>
			</div>
		{:else if !isLoading && displayValues.length === 0}
			<p class="py-1 text-xs text-base-content/50">
				{searchTerm ? 'No matching values' : 'No values found'}
			</p>
		{:else if !isLoading}
			<div class="flex flex-col gap-1">
				{#each isLevel ? sortBucketsBySeverity(displayValues) : displayValues as bucket (bucket.value)}
					{@const isActive = hasClause(name, bucket.value)}
					{#if isLevel}
						{@const dotColor = severityDotColor(bucket.value.toLowerCase())}
						{@const showFull = !anyActiveForField || isActive}
						<button
							class="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 text-xs transition-colors duration-150"
							role="checkbox"
							aria-checked={isActive}
							onclick={() => toggleValue(name, bucket.value)}
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
							<span class="w-10 shrink-0 text-right text-[10px] text-base-content/50 tabular-nums">
								{formatCountAsPercent(bucket.count, denominator)}
							</span>
						</button>
					{:else}
						<label class="flex cursor-pointer items-center gap-2 rounded px-1.5 text-xs">
							<input
								type="checkbox"
								class="checkbox checkbox-xs text-white checked:[--input-color:var(--color-primary)]"
								checked={isActive}
								onclick={(e) => {
									e.preventDefault();
									toggleValue(name, bucket.value);
								}}
							/>
							<span class="min-w-0 flex-1 truncate">{bucket.value}</span>
							<span class="w-10 shrink-0 text-right text-[10px] text-base-content/50 tabular-nums">
								{formatCountAsPercent(bucket.count, denominator)}
							</span>
						</label>
					{/if}
				{/each}
			</div>

			{#if !searchTerm && remaining > 0}
				<button
					class="mt-1 text-xs text-primary hover:underline"
					onclick={() => (fieldState(name).showCount += PAGE_SIZE)}
				>
					Show more ({remaining} remaining)
				</button>
			{:else if !searchTerm && shown > INITIAL_SHOW_COUNT && totalValues > INITIAL_SHOW_COUNT}
				<button
					class="mt-1 text-xs text-primary hover:underline"
					onclick={() => (fieldState(name).showCount = INITIAL_SHOW_COUNT)}
				>
					Show less
				</button>
			{/if}
		{/if}
	</div>
{/snippet}

{#snippet fieldRow(field: IndexField, indented: boolean = false)}
	{@const isLevel = field.name === levelField}
	{@const isOpen = openSections.has(field.name)}
	{@const countLabel = getFieldCountLabel(field.name)}

	<div class="border-b border-base-300/50">
		<div class="flex w-full items-center px-3 py-1.5{indented ? ' pl-6' : ''}">
			<button class="flex min-w-0 flex-1 items-center" onclick={() => toggleSection(field)}>
				{#if isOpen}
					<ChevronDown size={12} class="mr-1 shrink-0 text-base-content/60" />
				{:else}
					<ChevronRight size={12} class="mr-1 shrink-0 text-base-content/60" />
				{/if}
				<span
					class="min-w-0 flex-1 truncate text-left text-xs font-medium text-base-content"
					title={field.name}
				>
					{displayName(field)}
				</span>
			</button>
			{#if countLabel}
				<span class="text-[10px] text-base-content/40">({countLabel})</span>
			{/if}
		</div>

		{#if isOpen}
			{@render fieldValues(field, isLevel, indented)}
		{/if}
	</div>
{/snippet}

{#snippet groupHeader(opts: {
	label: string;
	count: number;
	isCollapsed: boolean;
	onToggle: () => void;
	dim?: boolean;
})}
	<div class="border-b border-base-300/50">
		<button class="flex w-full items-center px-3 py-1.5" onclick={opts.onToggle}>
			{#if opts.isCollapsed}
				<ChevronRight size={12} class="mr-1 shrink-0 text-base-content/60" />
			{:else}
				<ChevronDown size={12} class="mr-1 shrink-0 text-base-content/60" />
			{/if}
			<span
				class="flex-1 text-left text-xs font-medium {opts.dim
					? 'text-base-content/60'
					: 'text-base-content'}"
			>
				{opts.label}
			</span>
			<span class="text-[10px] text-base-content/40">({opts.count})</span>
		</button>
	</div>
{/snippet}

<div class="flex flex-col bg-base-100">
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
				<p class="text-xs text-primary">Clear</p>
			</button>
		{/if}
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
			{#each fastGroups as group (group.key)}
				{@const hasHeader = group.label !== ''}
				{@const collapsed = hasHeader && collapsedGroups.has(group.key)}
				{#if group.fields.length > 0}
					{#if hasHeader}
						{@render groupHeader({
							label: group.label,
							count: group.fields.length,
							isCollapsed: collapsed,
							onToggle: () => toggleGroup(group.key)
						})}
					{/if}
					{#if !collapsed}
						{#each group.fields as field (field.name)}
							{@render fieldRow(field, group.indented)}
						{/each}
					{/if}
				{/if}
			{/each}

			{#if nonFastFields.length > 0}
				{@render groupHeader({
					label: 'Other Fields',
					count: nonFastFields.length,
					isCollapsed: nonFastCollapsed,
					onToggle: () => (nonFastCollapsed = !nonFastCollapsed),
					dim: true
				})}

				{#if !nonFastCollapsed}
					{#each nonFastFields as field (field.name)}
						<div class="border-b border-base-300/50">
							<div class="flex w-full items-center px-3 py-1.5 pl-7">
								<span
									class="min-w-0 flex-1 truncate text-xs text-base-content/70"
									title={field.name}
								>
									{field.name}
								</span>
							</div>
						</div>
					{/each}
				{/if}
			{/if}
		</div>
	{/if}
</div>
