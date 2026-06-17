<script lang="ts">
	import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-svelte';
	import type { LogField, LogFieldValueBucket } from '$lib/types';
	import type { SearchStore } from '$lib/stores/search.svelte';
	/** Initial count of values shown collapsed before the user expands the row. */
	const FIELD_VALUES_INITIAL_SHOW = 10;

	/** Rows revealed per "Show more" click after the initial collapsed view. */
	const FIELD_VALUES_SHOW_MORE_STEP = 50;

	let {
		field,
		store,
		open,
		onToggle,
		values,
		loading,
		error,
		indented = false
	}: {
		field: LogField;
		store: SearchStore;
		open: boolean;
		onToggle: () => void;
		values: LogFieldValueBucket[] | null;
		loading: boolean;
		error: string | null;
		indented?: boolean;
	} = $props();

	let valueSearch = $state('');
	let showCount = $state(FIELD_VALUES_INITIAL_SHOW);

	const resolvedValues = $derived(values ?? []);

	const normalizedValueSearch = $derived(valueSearch.trim().toLowerCase());

	const filteredValues = $derived(
		normalizedValueSearch
			? resolvedValues.filter((b) => b.value.toLowerCase().includes(normalizedValueSearch))
			: resolvedValues
	);

	const fieldFilters = $derived(store.filters.filter((f) => f.field === field.name));

	const includedSet = $derived(new Set(fieldFilters.filter((f) => !f.exclude).map((f) => f.value)));
	const excludedSet = $derived(new Set(fieldFilters.filter((f) => f.exclude).map((f) => f.value)));

	const ghostValues = $derived.by<LogFieldValueBucket[]>(() => {
		if (fieldFilters.length === 0) return [];
		const seen = new Set(resolvedValues.map((b) => b.value));
		const ghosts: LogFieldValueBucket[] = [];
		const ghostSeen = new Set<string>();
		for (const f of fieldFilters) {
			if (seen.has(f.value) || ghostSeen.has(f.value)) continue;
			ghostSeen.add(f.value);
			ghosts.push({ value: f.value, count: 0 });
		}
		return ghosts;
	});

	const ghostSet = $derived(new Set(ghostValues.map((g) => g.value)));

	// Pinned = ghosts plus user-filtered in-result values; always fully shown (only the unpinned list truncates).
	const pinnedVisible = $derived.by<LogFieldValueBucket[]>(() => {
		const ghosts = normalizedValueSearch
			? ghostValues.filter((g) => g.value.toLowerCase().includes(normalizedValueSearch))
			: ghostValues;
		const fromResult = filteredValues.filter(
			(b) => includedSet.has(b.value) || excludedSet.has(b.value)
		);
		return [...ghosts, ...fromResult];
	});

	const unpinnedFiltered = $derived(
		filteredValues.filter((b) => !includedSet.has(b.value) && !excludedSet.has(b.value))
	);

	const unpinnedVisible = $derived(
		normalizedValueSearch ? unpinnedFiltered : unpinnedFiltered.slice(0, showCount)
	);

	const remaining = $derived(
		normalizedValueSearch ? 0 : Math.max(0, unpinnedFiltered.length - showCount)
	);

	const countLabel = $derived(resolvedValues.length > 0 ? `(${resolvedValues.length})` : '');

	function showMore() {
		showCount = Math.min(showCount + FIELD_VALUES_SHOW_MORE_STEP, filteredValues.length);
	}

	function showLess() {
		showCount = FIELD_VALUES_INITIAL_SHOW;
	}

	function toggleInclude(value: string) {
		if (includedSet.has(value)) {
			store.removeFilter(field.name, value, false);
		} else {
			store.addFilter(field.name, value, false);
		}
	}
</script>

<div class="border-line border-y [&+div]:border-t-0">
	<button
		type="button"
		class="flex w-full items-center gap-1 py-1.5 {indented ? 'pr-3 pl-6' : 'px-3'}"
		aria-expanded={open}
		onclick={onToggle}
	>
		{#if open}
			<ChevronDown class="text-base-content/60 h-3 w-3 shrink-0" />
		{:else}
			<ChevronRight class="text-base-content/60 h-3 w-3 shrink-0" />
		{/if}
		<span class="min-w-0 flex-1 truncate text-left text-xs" title={field.name}>
			{field.displayName}
		</span>
		{#if countLabel}
			<span class="text-base-content/40 text-[10px] leading-4">{countLabel}</span>
		{/if}
	</button>

	{#if open}
		<div class="pb-3 {indented ? 'pr-3 pl-6' : 'px-3'}">
			{#if loading && resolvedValues.length === 0}
				<div class="text-base-content/50 flex items-center gap-2 py-1 text-xs">
					<span class="loading loading-spinner loading-xs"></span>
					Loading…
				</div>
			{:else if error}
				<p class="text-error py-1 text-xs">{error}</p>
			{:else}
				{#if resolvedValues.length > FIELD_VALUES_INITIAL_SHOW}
					<input
						type="text"
						class="input input-xs mb-2 w-full"
						placeholder="Search values…"
						aria-label="Filter values"
						bind:value={valueSearch}
					/>
				{/if}

				{#if pinnedVisible.length === 0 && unpinnedVisible.length === 0}
					<p class="text-base-content/50 py-1 text-xs">
						{normalizedValueSearch ? 'No matching values' : 'No values found'}
					</p>
				{:else}
					{#snippet valueRow(bucket: LogFieldValueBucket)}
						{@const isIncluded = includedSet.has(bucket.value)}
						{@const isExcluded = excludedSet.has(bucket.value)}
						{@const isGhost = ghostSet.has(bucket.value)}
						<li
							class="group relative flex items-center gap-2 rounded px-1.5 py-0.5 font-mono text-xs"
						>
							{#if isExcluded}
								<button
									type="button"
									class="bg-error text-error-content flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-sm"
									aria-label="Remove exclude filter"
									title="Excluded — click to remove"
									onclick={(e) => {
										store.removeFilter(field.name, bucket.value, true);
										e.currentTarget.blur();
									}}
								>
									<Minus class="h-3 w-3" />
								</button>
							{:else}
								<input
									type="checkbox"
									class="checkbox checkbox-xs"
									checked={isIncluded}
									aria-label={isIncluded ? 'Remove include filter' : 'Include value'}
									onclick={(e) => {
										e.preventDefault();
										toggleInclude(bucket.value);
										e.currentTarget.blur();
									}}
								/>
							{/if}
							<button
								type="button"
								class="min-w-0 flex-1 cursor-pointer truncate text-left"
								onclick={(e) => {
									toggleInclude(bucket.value);
									e.currentTarget.blur();
								}}
							>
								{bucket.value}
							</button>
							<span
								class="text-base-content/50 shrink-0 text-right text-[10px] tabular-nums transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0"
							>
								{isGhost || isExcluded ? '—' : bucket.count.toLocaleString()}
							</span>
							<span
								class="border-line bg-base-100 pointer-events-none absolute right-1 flex shrink-0 translate-x-1 overflow-hidden rounded opacity-0 transition-all duration-150 ease-out group-focus-within:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
							>
								<button
									type="button"
									class="flex h-5 w-5 cursor-pointer items-center justify-center"
									aria-label="Filter for value"
									title="Filter for value"
									onclick={(e) => {
										store.addFilter(field.name, bucket.value, false);
										e.currentTarget.blur();
									}}
								>
									<Plus class="h-3 w-3" />
								</button>
								<button
									type="button"
									class="flex h-5 w-5 cursor-pointer items-center justify-center"
									aria-label="Filter out value"
									title="Filter out value"
									onclick={(e) => {
										store.addFilter(field.name, bucket.value, true);
										e.currentTarget.blur();
									}}
								>
									<Minus class="h-3 w-3" />
								</button>
							</span>
						</li>
					{/snippet}

					<ul class="flex flex-col gap-0.5">
						{#each pinnedVisible as bucket (bucket.value)}
							{@render valueRow(bucket)}
						{/each}
						{#if pinnedVisible.length > 0 && unpinnedVisible.length > 0}
							<li role="separator" class="border-line my-1 border-t" aria-hidden="true"></li>
						{/if}
						{#each unpinnedVisible as bucket (bucket.value)}
							{@render valueRow(bucket)}
						{/each}
					</ul>

					{#if !normalizedValueSearch && remaining > 0}
						<button
							type="button"
							class="text-success mt-1 text-xs font-medium hover:underline"
							onclick={showMore}
						>
							Show more ({remaining})
						</button>
					{:else if !normalizedValueSearch && showCount > FIELD_VALUES_INITIAL_SHOW && resolvedValues.length > FIELD_VALUES_INITIAL_SHOW}
						<button
							type="button"
							class="text-success mt-1 text-xs font-medium hover:underline"
							onclick={showLess}
						>
							Show less
						</button>
					{/if}
				{/if}
			{/if}
		</div>
	{/if}
</div>
