<script lang="ts">
	import { ChevronDown, ChevronRight, Search } from 'lucide-svelte';
	import type { LevelBucket, LogField, LogFieldValueBucket, Filter } from '$lib/types';
	import { isOtelAttr, isOtelResourceAttr, serializeTimeRange } from '$lib/utils/fields';
	import { sortBySeverity } from '$lib/utils/severity';
	import { levelColor } from '$lib/constants/level-colors';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import { fetchFieldValues, fetchFieldValuesBulk } from '$lib/api/field-values';
	import { filterKey } from '$lib/utils/query-params';

	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import { readOpenFields, writeOpenFields } from '$lib/utils/field-open-state';
	import SidebarFieldRow from './SidebarFieldRow.svelte';

	let { store }: { store: SearchStore } = $props();

	type GroupKey = 'top' | 'attributes' | 'resource_attributes';
	type FieldGroup = { key: GroupKey; label: string; fields: LogField[] };

	let searchTerm = $state('');
	let inputEl: HTMLInputElement | null = $state(null);
	let groupsCollapsed = $state<Record<'attributes' | 'resource_attributes', boolean>>({
		attributes: false,
		resource_attributes: false
	});

	let openFields = $state<Set<string>>(new Set());

	$effect(() => {
		const id = store.selectedIndex;
		openFields = id ? readOpenFields(id) : new Set();
	});

	$effect(() => {
		const id = store.selectedIndex;
		if (!id) return;
		writeOpenFields(id, openFields);
	});

	function toggleOpen(name: string): void {
		const next = new Set(openFields);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		openFields = next;
	}

	type CacheEntry = { key: string; values: LogFieldValueBucket[] };
	let valuesByField = $state<Map<string, CacheEntry>>(new Map());
	let loadingFields = $state<Set<string>>(new Set());
	let errorByField = $state<Map<string, string>>(new Map());
	let abortCtl: AbortController | null = null;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Per-field cache key excludes same-field filters: toggling a filter on the
	// open field must not invalidate its own buckets, but other fields' filters must.
	function fieldCacheKey(id: string, field: string): string {
		const otherFilters = store.filters.filter((f) => f.field !== field);
		const filtersKey = otherFilters.map(filterKey).join(',');
		return `${id}|${store.query}|${serializeTimeRange(store.timeRange)}|${filtersKey}`;
	}

	// Trigger includes all filters so any change re-runs; per-field cache decides which rows fetch.
	const triggerKey = $derived.by(() => {
		const id = store.selectedIndex;
		if (!id) return null;
		const filtersKey = store.filters.map(filterKey).join(',');
		const openKey = [...openFields].toSorted().join(',');
		return `${id}|${store.query}|${serializeTimeRange(store.timeRange)}|${filtersKey}|${openKey}`;
	});

	function runOrchestrator() {
		const id = store.selectedIndex;
		if (!id) return;

		const openList = [...openFields];
		const desiredKeys = new Map(openList.map((f) => [f, fieldCacheKey(id, f)]));

		const prunedValues = new Map<string, CacheEntry>();
		for (const [f, entry] of valuesByField) {
			if (openFields.has(f) && entry.key === desiredKeys.get(f)) {
				prunedValues.set(f, entry);
			}
		}
		const prunedErrors = new Map<string, string>();
		for (const [f, msg] of errorByField) {
			if (openFields.has(f) && !prunedValues.has(f)) {
				prunedErrors.set(f, msg);
			}
		}
		const prunedLoading = new Set<string>();
		for (const f of loadingFields) {
			if (openFields.has(f)) prunedLoading.add(f);
		}

		const pending = openList.filter((f) => !prunedValues.has(f));
		if (pending.length === 0) {
			valuesByField = prunedValues;
			errorByField = prunedErrors;
			loadingFields = prunedLoading;
			return;
		}

		for (const f of pending) prunedErrors.delete(f);
		for (const f of pending) prunedLoading.add(f);
		valuesByField = prunedValues;
		errorByField = prunedErrors;
		loadingFields = prunedLoading;

		abortCtl?.abort();
		const ctl = new AbortController();
		abortCtl = ctl;

		const filters: Filter[] = store.filters;
		const fetchPromise =
			pending.length === 1
				? fetchFieldValues({
						indexId: id,
						field: pending[0],
						query: store.query,
						filters: filters.filter((f) => f.field !== pending[0]),
						timeRange: store.timeRange,
						signal: ctl.signal
					}).then((arr) => ({ [pending[0]]: arr }))
				: fetchFieldValuesBulk({
						indexId: id,
						fields: pending,
						query: store.query,
						filters,
						timeRange: store.timeRange,
						signal: ctl.signal
					});

		fetchPromise
			.then((result) => {
				if (ctl.signal.aborted) return;
				const nextValues = new Map(valuesByField);
				const nextErrors = new Map(errorByField);
				for (const f of pending) {
					const k = desiredKeys.get(f);
					if (k === undefined) continue;
					nextValues.set(f, { key: k, values: result[f] ?? [] });
					nextErrors.delete(f);
				}
				valuesByField = nextValues;
				errorByField = nextErrors;
				const nl = new Set(loadingFields);
				for (const f of pending) nl.delete(f);
				loadingFields = nl;
			})
			.catch((err: unknown) => {
				if (ctl.signal.aborted) return;
				const msg = err instanceof Error ? err.message : 'Failed to load values';
				const nextErrors = new Map(errorByField);
				for (const f of pending) nextErrors.set(f, msg);
				errorByField = nextErrors;
				const nl = new Set(loadingFields);
				for (const f of pending) nl.delete(f);
				loadingFields = nl;
			});
	}

	$effect(() => {
		void triggerKey;
		if (debounceTimer !== null) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			runOrchestrator();
		}, 30);
		return () => {
			if (debounceTimer !== null) clearTimeout(debounceTimer);
		};
	});

	// Unmount-only cleanup: abort any in-flight fetch when the panel disappears.
	// Kept in its own effect with no reactive reads so it runs once at teardown,
	// independent of the orchestrator's per-change debounce.
	$effect(() => {
		return () => {
			abortCtl?.abort();
		};
	});

	const normalized = $derived(searchTerm.trim().toLowerCase());

	const isOtelIndex = $derived(store.fieldConfig?.isOtel ?? false);
	const levels = $derived(store.levels);
	const fields = $derived(store.fields);

	const filteredLevels = $derived(
		normalized ? levels.filter((l) => l.name.toLowerCase().includes(normalized)) : levels
	);

	const sortedLevels = $derived.by(() => {
		const order = sortBySeverity(filteredLevels.map((l) => l.name));
		const byName = new Map(filteredLevels.map((l) => [l.name, l]));
		const result: LevelBucket[] = [];
		for (const n of order) {
			const v = byName.get(n);
			if (v) result.push(v);
		}
		return result;
	});

	const groups = $derived.by<FieldGroup[]>(() => {
		const matching = normalized
			? fields.filter((f) => f.displayName.toLowerCase().includes(normalized))
			: fields;

		if (!isOtelIndex) {
			return [{ key: 'top', label: '', fields: matching }];
		}

		const top: LogField[] = [];
		const attrs: LogField[] = [];
		const resourceAttrs: LogField[] = [];
		for (const f of matching) {
			if (isOtelResourceAttr(f.name)) resourceAttrs.push(f);
			else if (isOtelAttr(f.name)) attrs.push(f);
			else top.push(f);
		}
		return [
			{ key: 'top', label: '', fields: top },
			{ key: 'attributes', label: 'Attributes', fields: attrs },
			{ key: 'resource_attributes', label: 'Resource Attributes', fields: resourceAttrs }
		];
	});

	const totalFieldMatches = $derived(groups.reduce((sum, g) => sum + g.fields.length, 0));
	const matchCount = $derived(filteredLevels.length + totalFieldMatches);
	const isAllEmpty = $derived(normalized.length > 0 && matchCount === 0);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			searchTerm = '';
			inputEl?.blur();
		}
	}

	function toggleGroup(key: 'attributes' | 'resource_attributes') {
		groupsCollapsed[key] = !groupsCollapsed[key];
	}
</script>

<div class="bg-base-100 flex h-full flex-col">
	<!-- h-12 to align with the rail header + SearchToolbar -->
	<div class="border-line bg-base-100 sticky top-0 z-10 flex h-12 items-center border-b px-3">
		<label class="input input-sm w-full gap-2">
			<Search class="text-base-content/50 h-3.5 w-3.5" />
			<input
				type="text"
				placeholder="Filter fields…"
				aria-label="Filter fields"
				bind:this={inputEl}
				bind:value={searchTerm}
				onkeydown={handleKeydown}
			/>
			{#if normalized && !isAllEmpty}
				<span class="text-base-content/50 text-xs tabular-nums">{matchCount}</span>
			{/if}
		</label>
	</div>

	<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="min-h-0 flex-1">
		{#if store.fieldsError}
			<div class="flex flex-col items-center gap-2 p-6 text-center">
				<p class="text-error text-xs">{store.fieldsError}</p>
				<p class="text-base-content/50 text-[10px]">Field list failed to load.</p>
				<button
					type="button"
					class="btn btn-ghost btn-xs mt-1"
					onclick={() => store.reloadFields()}
				>
					Retry
				</button>
			</div>
		{:else if isAllEmpty}
			<p class="text-base-content/50 p-6 text-center text-xs">No matches</p>
		{:else}
			{#if (store.fieldConfig?.levelField ?? null) !== null}
				{#if store.histogramLoading}
					<section class="p-3">
						<p class="eyebrow mb-2">Levels</p>
						<div class="flex items-center justify-center py-2">
							<span class="loading loading-spinner loading-xs"></span>
						</div>
					</section>
				{:else if sortedLevels.length > 0}
					{@const levelField = store.fieldConfig?.levelField ?? null}
					{@const anyActiveForField =
						levelField !== null && store.filters.some((f) => f.field === levelField && !f.exclude)}
					<section class="p-3">
						<p class="eyebrow mb-2">Levels</p>
						<ul class="space-y-0.5">
							{#each sortedLevels as level (level.name)}
								{@const isActive =
									levelField !== null && store.hasFilter(levelField, level.name, false)}
								{@const showFull = !anyActiveForField || isActive}
								<li>
									<button
										type="button"
										class="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-left font-mono text-xs transition-colors duration-150 disabled:cursor-not-allowed"
										role="checkbox"
										aria-checked={isActive}
										disabled={levelField === null}
										onclick={() => store.toggleLevelFilter(level.name)}
									>
										{#if showFull}
											<span
												class="h-2 w-2 shrink-0 rounded-full transition-colors duration-150"
												style="background-color: {levelColor(level.name)};"
											></span>
										{:else}
											<span
												class="bg-base-content/20 h-2 w-2 shrink-0 rounded-full transition-colors duration-150"
											></span>
										{/if}
										<span
											class="min-w-0 flex-1 truncate transition-colors duration-150 {showFull
												? ''
												: 'text-base-content/40'}"
										>
											{level.name}
										</span>
										<span class="text-base-content/50 shrink-0 text-right tabular-nums">
											{level.count === null ? '—' : level.count.toLocaleString()}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}

			{#if store.fieldsLoading && fields.length === 0}
				<div class="text-base-content/50 flex items-center justify-center gap-2 p-6 text-xs">
					<span class="loading loading-spinner loading-xs"></span>
					Loading fields…
				</div>
			{:else}
				{#each groups as group (group.key)}
					{#if group.fields.length > 0}
						{#if group.label}
							{@const isCollapsed =
								groupsCollapsed[group.key as 'attributes' | 'resource_attributes']}
							<button
								type="button"
								class="border-line flex w-full items-center gap-1 border-b px-3 py-1.5"
								aria-expanded={!isCollapsed}
								onclick={() => toggleGroup(group.key as 'attributes' | 'resource_attributes')}
							>
								{#if isCollapsed}
									<ChevronRight class="text-base-content/60 h-3 w-3 shrink-0" />
								{:else}
									<ChevronDown class="text-base-content/60 h-3 w-3 shrink-0" />
								{/if}
								<span class="flex-1 text-left text-xs font-medium">{group.label}</span>
								<span class="text-base-content/40 text-[10px] leading-4"
									>({group.fields.length})</span
								>
							</button>
							{#if !isCollapsed}
								{#each group.fields as field (field.name)}
									<SidebarFieldRow
										{field}
										{store}
										open={openFields.has(field.name)}
										onToggle={() => toggleOpen(field.name)}
										values={valuesByField.get(field.name)?.values ?? null}
										loading={loadingFields.has(field.name)}
										error={errorByField.get(field.name) ?? null}
										indented
									/>
								{/each}
							{/if}
						{:else}
							{#each group.fields as field (field.name)}
								<SidebarFieldRow
									{field}
									{store}
									open={openFields.has(field.name)}
									onToggle={() => toggleOpen(field.name)}
									values={valuesByField.get(field.name)?.values ?? null}
									loading={loadingFields.has(field.name)}
									error={errorByField.get(field.name) ?? null}
								/>
							{/each}
						{/if}
					{/if}
				{/each}
			{/if}
		{/if}
	</OverlayScrollbarsComponent>
</div>
