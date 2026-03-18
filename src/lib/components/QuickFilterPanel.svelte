<script lang="ts">
	import { ChevronRight, ChevronDown, X, Check, Settings, Pin, GripVertical, Plus } from 'lucide-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { dndzone } from 'svelte-dnd-action';
	import type { IndexField } from '$lib/types';

	let {
		fields,
		aggregations,
		activeFilters = $bindable(),
		onfilter,
		availableFields = [],
		onconfigchange,
		onsearch,
		pinnedFields = []
	}: {
		fields: string[];
		aggregations: Record<string, string[]>;
		activeFilters: Record<string, string[]>;
		onfilter?: (filters: Record<string, string[]>) => void;
		availableFields?: IndexField[];
		onconfigchange?: (fields: string[]) => void;
		onsearch?: (field: string, searchTerm: string) => Promise<string[]>;
		pinnedFields?: string[];
	} = $props();

	let collapsed = $state(false);
	let openSections = new SvelteSet<string>();
	let configMode = $state(false);
	let configFields = $state<{ id: string; name: string }[]>([]);

	let searchTerms = $state<Record<string, string>>({});
	let searchResults = $state<Record<string, string[] | null>>({});
	let loadingFields = new SvelteSet<string>();
	let expandedFields = new SvelteSet<string>();
	let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	$effect(() => {
		return () => {
			for (const timer of Object.values(debounceTimers)) clearTimeout(timer);
		};
	});

	const INITIAL_SHOW_COUNT = 10;

	function handleSearchInput(field: string, value: string) {
		searchTerms = { ...searchTerms, [field]: value };

		clearTimeout(debounceTimers[field]);

		if (!value.trim()) {
			searchResults = { ...searchResults, [field]: null };
			loadingFields.delete(field);
			return;
		}

		loadingFields.add(field);
		debounceTimers[field] = setTimeout(async () => {
			const currentTerm = searchTerms[field];
			if (!currentTerm?.trim() || !onsearch) {
				loadingFields.delete(field);
				return;
			}

			try {
				const values = await onsearch(field, currentTerm.trim());
				// Only update if search term hasn't changed while waiting
				if (searchTerms[field] === currentTerm) {
					searchResults = { ...searchResults, [field]: values };
				}
			} catch {
				if (searchTerms[field] === currentTerm) {
					searchResults = { ...searchResults, [field]: null };
				}
			} finally {
				loadingFields.delete(field);
			}
		}, 300);
	}

	function getDisplayValues(field: string): string[] {
		const searched = searchResults[field];
		if (searched !== null && searched !== undefined) {
			return searched;
		}
		const allValues = aggregations[field] ?? [];
		if (expandedFields.has(field)) {
			return allValues;
		}
		return allValues.slice(0, INITIAL_SHOW_COUNT);
	}

	// Open first section by default, reset on fields change
	$effect(() => {
		if (fields.length > 0) {
			openSections.clear();
			openSections.add(fields[0]);
		}
	});

	let pinnedSet = $derived(new Set(pinnedFields));
	let pinnedConfigFields = $derived(configFields.filter((f) => pinnedSet.has(f.name)));
	let draggableConfigFields = $state<{ id: string; name: string }[]>([]);

	// Keep draggableConfigFields in sync with configFields changes (from enter/add/remove)
	$effect(() => {
		draggableConfigFields = configFields.filter((f) => !pinnedSet.has(f.name));
	});

	let filteredConfigAvailable = $derived(
		availableFields.filter((f) => !configFields.some((a) => a.name === f.name))
	);

	function enterConfigMode() {
		configFields = fields.map((name) => ({ id: name, name }));
		collapsed = false;
		configMode = true;
	}

	function exitConfigMode() {
		configMode = false;
	}

	function handleConfigDndConsider(e: CustomEvent<{ items: typeof draggableConfigFields }>) {
		draggableConfigFields = e.detail.items;
	}

	function handleConfigDndFinalize(e: CustomEvent<{ items: typeof draggableConfigFields }>) {
		draggableConfigFields = e.detail.items;
		configFields = [...pinnedConfigFields, ...draggableConfigFields];
		onconfigchange?.(configFields.map((f) => f.name));
	}

	function addConfigField(name: string) {
		configFields = [...configFields, { id: name, name }];
		onconfigchange?.(configFields.map((f) => f.name));
	}

	function removeConfigField(name: string) {
		if (pinnedSet.has(name)) return;
		configFields = configFields.filter((f) => f.name !== name);
		onconfigchange?.(configFields.map((f) => f.name));
	}

	function toggleSection(field: string) {
		if (openSections.has(field)) {
			openSections.delete(field);
		} else {
			openSections.add(field);
		}
	}

	function toggleValue(field: string, value: string) {
		const current = activeFilters[field] ?? [];
		const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

		const updated = { ...activeFilters };
		if (next.length === 0) {
			delete updated[field];
		} else {
			updated[field] = next;
		}
		activeFilters = updated;
		onfilter?.(updated);
	}

	let activeFilterCount = $derived(
		Object.values(activeFilters).reduce((sum, vals) => sum + vals.length, 0)
	);
	let hasAnyFilters = $derived(activeFilterCount > 0);

	function clearAllFilters() {
		activeFilters = {};
		onfilter?.({});
	}

	function isChecked(field: string, value: string): boolean {
		return activeFilters[field]?.includes(value) ?? false;
	}
</script>

{#if fields.length > 0 || availableFields.length > 0}
	<div class="border-b border-base-300">
		<div class="flex items-center px-3 py-2">
			<button class="flex flex-1 items-center" onclick={() => (collapsed = !collapsed)}>
				{#if collapsed}
					<ChevronRight size={14} class="mr-1 text-base-content/60" />
				{:else}
					<ChevronDown size={14} class="mr-1 text-base-content/60" />
				{/if}
				<h3
					class="flex-1 text-left text-xs font-semibold tracking-wider text-base-content/80 uppercase"
				>
					Filters
				</h3>
				{#if collapsed && hasAnyFilters}
					<span class="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
						{activeFilterCount}
					</span>
				{/if}
			</button>
			{#if hasAnyFilters}
				<button
					class="btn p-0 btn-ghost btn-xs"
					onclick={clearAllFilters}
					title="Clear all filters"
				>
					<X size={14} class="text-base-content/60" />
				</button>
			{/if}
			{#if availableFields.length > 0}
				<button
					class="btn ml-1 p-0 btn-ghost btn-xs"
					onclick={() => (configMode ? exitConfigMode() : enterConfigMode())}
					title={configMode ? 'Done configuring' : 'Configure filter fields'}
				>
					{#if configMode}
					<Check size={14} class="text-base-content/60" />
				{:else}
					<Settings size={14} class="text-base-content/60" />
				{/if}
				</button>
			{/if}
		</div>

		{#if !collapsed}
			{#if configMode}
				<div class="flex flex-col">
					<div class="border-t border-base-300/50 p-2">
						<p class="mb-1 text-xs font-medium text-base-content/50">Active</p>
						{#if configFields.length === 0}
							<p class="px-1 py-2 text-xs text-base-content/50">No filter fields</p>
						{:else}
							<div class="flex flex-col gap-1">
								{#each pinnedConfigFields as field (field.id)}
									<div class="flex items-center gap-1 rounded bg-base-200 px-2 py-1 text-xs">
										<Pin size={12} class="shrink-0 text-base-content/50" />
										<span class="flex-1 truncate">{field.name}</span>
									</div>
								{/each}
								<div
									use:dndzone={{
										items: draggableConfigFields,
										flipDurationMs: 150,
										type: 'config-fields'
									}}
									onconsider={handleConfigDndConsider}
									onfinalize={handleConfigDndFinalize}
									class="flex flex-col gap-1"
								>
									{#each draggableConfigFields as field (field.id)}
										<div class="flex items-center gap-1 rounded bg-base-200 px-2 py-1 text-xs">
											<GripVertical size={12} class="shrink-0 cursor-grab text-base-content/60" />
											<span class="flex-1 truncate">{field.name}</span>
											<button
												class="btn p-0 btn-ghost btn-xs"
												onclick={() => removeConfigField(field.name)}
											>
												<X size={12} />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					{#if filteredConfigAvailable.length > 0}
						<div class="border-t border-base-300/50 p-2">
							<p class="mb-1 text-xs font-medium text-base-content/50">Available</p>
							<div class="flex flex-col gap-0.5">
								{#each filteredConfigAvailable as field (field.name)}
									<button
										class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-base-200"
										onclick={() => addConfigField(field.name)}
									>
										<Plus size={12} class="shrink-0 text-base-content/60" />
										<span class="truncate">{field.name}</span>
										<span class="ml-auto text-[10px] text-base-content/50">{field.type}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else if fields.length === 0}
				<div class="px-3 pb-3">
					<p class="text-[11px] text-base-content/50">Click the gear icon to add filter fields</p>
				</div>
			{:else}
				<div class="flex flex-col">
					{#each fields as field (field)}
						<div class="border-t border-base-300/50">
							<button
								class="flex w-full items-center px-3 py-1.5"
								onclick={() => toggleSection(field)}
							>
								{#if openSections.has(field)}
								<ChevronDown size={12} class="mr-1 text-base-content/60" />
							{:else}
								<ChevronRight size={12} class="mr-1 text-base-content/60" />
							{/if}
								<span
									class="min-w-0 flex-1 truncate text-left text-xs font-medium text-base-content/70"
									title={field}>{field}</span
								>
								{#if activeFilters[field]?.length}
									<span class="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
										{activeFilters[field].length}
									</span>
								{/if}
							</button>

							{#if openSections.has(field)}
								<div class="px-3 pb-2">
									{#if (aggregations[field] ?? []).length > INITIAL_SHOW_COUNT}
										<input
											type="text"
											class="input input-xs mb-1.5 w-full border-base-300 bg-base-200/50"
											placeholder="Search values..."
											value={searchTerms[field] ?? ''}
											oninput={(e) => handleSearchInput(field, e.currentTarget.value)}
										/>
									{/if}
									{#if loadingFields.has(field)}
										<div class="flex items-center gap-2 py-1">
											<span class="loading loading-xs loading-spinner"></span>
											<span class="text-[11px] text-base-content/50">Searching...</span>
										</div>
									{:else if getDisplayValues(field).length === 0}
										<p class="py-1 text-[11px] text-base-content/50">
											{searchTerms[field]?.trim()
												? 'No matching values'
												: 'Run a search to see values'}
										</p>
									{:else}
										<div class="flex flex-col gap-0.5">
											{#each getDisplayValues(field) as value (value)}
												<label
													class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-base-200"
												>
													<input
														type="checkbox"
														class="checkbox checkbox-xs"
														checked={isChecked(field, value)}
														onchange={() => toggleValue(field, value)}
													/>
													<span class="truncate">{value}</span>
												</label>
											{/each}
										</div>
										{#if !searchTerms[field]?.trim() && (aggregations[field] ?? []).length > INITIAL_SHOW_COUNT && !expandedFields.has(field)}
											<button
												class="mt-1 text-[11px] text-primary hover:underline"
												onclick={() => expandedFields.add(field)}
											>
												Show all {(aggregations[field] ?? []).length}
											</button>
										{:else if !searchTerms[field]?.trim() && expandedFields.has(field) && (aggregations[field] ?? []).length > INITIAL_SHOW_COUNT}
											<button
												class="mt-1 text-[11px] text-primary hover:underline"
												onclick={() => expandedFields.delete(field)}
											>
												Show less
											</button>
										{/if}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/if}
