<script module lang="ts">
	/** Initial count of values shown collapsed before the user expands the row. */
	export const FIELD_VALUES_INITIAL_SHOW = 10;
</script>

<script lang="ts">
	import { ChevronDown, ChevronRight, Minus, Pin, Plus } from 'lucide-svelte';
	import type { LogField, LogFieldValueBucket } from '$lib/types';
	import type { SearchStore } from '$lib/stores/search.svelte';

	/** Rows revealed per "Show more" click after the initial collapsed view. */
	const FIELD_VALUES_SHOW_MORE_STEP = 50;

	// Virtualization unmounts off-screen rows, so the parent owns `valueSearch`/`showCount` by name.
	let {
		field,
		store,
		open,
		onToggle,
		values,
		loading,
		error,
		indented = false,
		label = field.displayName,
		sampleCount = 0,
		sampleTotal = 0,
		pinned,
		onPin,
		valueSearch = $bindable(''),
		showCount = $bindable(FIELD_VALUES_INITIAL_SHOW)
	}: {
		field: LogField;
		store: SearchStore;
		open: boolean;
		onToggle: () => void;
		values: LogFieldValueBucket[] | null;
		loading: boolean;
		error: string | null;
		indented?: boolean;
		label?: string;
		/** Sampled hits carrying this field, and the size of that sample. */
		sampleCount?: number;
		sampleTotal?: number;
		pinned: boolean;
		onPin: () => void;
		valueSearch?: string;
		showCount?: number;
	} = $props();

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

	// Clamped off both ends: a rounded extreme would claim more than the sample can support.
	const sampleShare = $derived.by(() => {
		if (sampleTotal === 0 || sampleCount === 0) return null;
		if (sampleCount === sampleTotal) return 100;
		return Math.min(99, Math.max(1, Math.round((sampleCount / sampleTotal) * 100)));
	});

	// Closed: the share of the sampled page carrying the field, not a doc count. Open: how many
	// values loaded below, and nothing until they land.
	const countLabel = $derived(
		open
			? resolvedValues.length > 0
				? `(${resolvedValues.length})`
				: ''
			: sampleShare === null
				? ''
				: `${sampleShare}%`
	);
	const countTitle = $derived(
		open || sampleShare === null ? undefined : `In ${sampleCount} of ${sampleTotal} sampled results`
	);

	function showMore() {
		showCount += FIELD_VALUES_SHOW_MORE_STEP;
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

<div class="border-line {open ? 'border-b' : ''}">
	<div class="flex items-center pr-2 {indented ? 'pl-5' : 'pl-3'}">
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-1 py-1.5"
			aria-expanded={open}
			aria-label={field.name}
			onclick={onToggle}
		>
			{#if open}
				<ChevronDown class="text-base-content/60 h-3 w-3 shrink-0" />
			{:else}
				<ChevronRight class="text-base-content/60 h-3 w-3 shrink-0" />
			{/if}
			<span class="min-w-0 flex-1 truncate text-left text-xs" title={field.name}>
				{label}
			</span>
			{#if countLabel}
				<span class="text-subtle shrink-0 text-xs tabular-nums" title={countTitle}
					>{countLabel}</span
				>
			{/if}
		</button>
		<button
			type="button"
			class="hover:bg-base-200 ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded {pinned
				? 'text-base-content'
				: 'text-subtle'}"
			aria-label={`${pinned ? 'Unpin' : 'Pin'} ${field.name}`}
			aria-pressed={pinned}
			title={pinned ? 'Unpin field' : 'Pin field'}
			onclick={onPin}
		>
			<Pin class="h-3 w-3 {pinned ? 'fill-current' : ''}" />
		</button>
	</div>

	{#if open}
		<div class="pr-3 pb-3 {indented ? 'pl-5' : 'pl-3'}">
			<!-- `values === null` is "not fetched yet"; only an empty array means "no values". -->
			{#if error}
				<p class="text-error py-1 text-xs [overflow-wrap:anywhere]">{error}</p>
			{:else if (loading || values === null) && resolvedValues.length === 0}
				<div class="text-subtle flex items-center gap-2 py-1 text-xs">
					<span class="loading loading-spinner loading-xs"></span>
					Loading…
				</div>
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
					<p class="text-subtle py-1 text-xs">
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
								class="text-subtle shrink-0 text-right font-sans text-xs tabular-nums transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0"
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
