<script lang="ts">
	import { page } from '$app/state';
	import { get } from 'svelte/store';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import { ChevronDown, ChevronRight, Search } from 'lucide-svelte';
	import type { LevelBucket, LogField, LogFieldValueBucket } from '$lib/types';
	import { serializeTimeRange } from '$lib/utils/fields';
	import { buildFieldSections, type SectionKey } from '$lib/components/logs/field-list';
	import { sortBySeverity } from '$lib/components/logs/severity';
	import { levelColor, UNKNOWN_LEVEL } from '$lib/constants/level-colors';
	import type { SearchStore } from '$lib/components/logs/search.svelte';
	import { fetchFieldValuesBulk } from '$lib/api/field-values';
	import { filterKey } from '$lib/utils/query-params';

	import { SvelteMap, SvelteSet } from 'svelte/reactivity';

	import { readStringArray, writeJSON } from '$lib/utils/safe-storage';
	import SidebarFieldRow, { FIELD_VALUES_INITIAL_SHOW } from './SidebarFieldRow.svelte';

	let { store }: { store: SearchStore } = $props();
	const selectedIndex = $derived(store.selectedIndex);

	type CollapsibleKey = Exclude<SectionKey, 'top'>;
	type PanelItem =
		| { kind: 'header'; key: string; group: CollapsibleKey; label: string; collapsed: boolean }
		| { kind: 'row'; key: string; field: LogField; label: string; count: number; indent: boolean };

	const ROW_ESTIMATE = 29;
	const OVERSCAN = 8;
	const VALUES_DEBOUNCE_MS = 30;

	let searchTerm = $state('');
	let inputEl: HTMLInputElement | null = $state(null);
	let groupsCollapsed = $state<Record<CollapsibleKey, boolean>>({
		pinned: false,
		attributes: false,
		resource_attributes: false
	});

	const storageKey = (indexId: string) => `rootprint:fields-open:${indexId}`;
	const collapsedStorageKey = (indexId: string) => `rootprint:fields-collapsed:${indexId}`;

	let openFields = $state<Set<string>>(new Set());
	let pinnedFields = $state<Set<string>>(new Set());
	const pinStorageKey = $derived(
		page.data.session?.user.id && selectedIndex
			? `rootprint:fields-pinned:${page.data.session.user.id}:${selectedIndex}`
			: null
	);

	$effect(() => {
		const key = pinStorageKey;
		pinnedFields = new Set(key ? readStringArray(key) : []);
	});

	$effect(() => {
		const id = selectedIndex;
		openFields = id ? new Set(readStringArray(storageKey(id))) : new Set();
	});

	$effect(() => {
		const id = selectedIndex;
		const saved = new Set(id ? readStringArray(collapsedStorageKey(id)) : []);
		groupsCollapsed = {
			pinned: saved.has('pinned'),
			attributes: saved.has('attributes'),
			resource_attributes: saved.has('resource_attributes')
		};
	});

	function toggleOpen(name: string): void {
		const next = new Set(openFields);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		openFields = next;
		if (selectedIndex) writeJSON(storageKey(selectedIndex), [...next]);
	}

	function togglePin(name: string): void {
		const next = new Set(pinnedFields);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		pinnedFields = next;
		if (pinStorageKey) writeJSON(pinStorageKey, [...next]);
	}

	type CacheEntry = { key: string; values: LogFieldValueBucket[] };
	const valuesByField = new SvelteMap<string, CacheEntry>();
	// Row-local view state lives here so a row unmounted by scrolling comes back unchanged.
	const valueSearchByField = new SvelteMap<string, string>();
	const showCountByField = new SvelteMap<string, number>();
	const loadingFields = new SvelteSet<string>();
	const errorByField = new SvelteMap<string, string>();

	// Per-field cache key excludes same-field filters: toggling a filter on the
	// open field must not invalidate its own buckets, but other fields' filters must.
	function fieldCacheKey(id: string, field: string): string {
		const otherFilters = store.filters.filter((f) => f.field !== field);
		const filtersKey = otherFilters.map(filterKey).join(',');
		return `${id}|${store.query}|${serializeTimeRange(store.timeRange)}|${filtersKey}|${store.refreshRevision}`;
	}

	const knownFieldNames = $derived(new Set(store.fields.map((f) => f.name)));

	const eligibleOpen = $derived([...openFields].filter((f) => knownFieldNames.has(f)).toSorted());

	// Trigger includes all filters so any change re-runs; per-field cache decides which rows fetch.
	const triggerKey = $derived.by(() => {
		const id = store.selectedIndex;
		if (!id) return null;
		const filtersKey = store.filters.map(filterKey).join(',');
		const openKey = eligibleOpen.join(',');
		return `${id}|${store.query}|${serializeTimeRange(store.timeRange)}|${filtersKey}|${openKey}|${store.refreshRevision}`;
	});

	function runOrchestrator(signal: AbortSignal) {
		const id = store.selectedIndex;
		if (!id || !store.fieldsReady) return;

		const openList = eligibleOpen;
		const open = new Set(openList);
		const desiredKeys = new Map(openList.map((f) => [f, fieldCacheKey(id, f)]));

		for (const [f, entry] of valuesByField) {
			if (!open.has(f) || entry.key !== desiredKeys.get(f)) valuesByField.delete(f);
		}
		// An open field's spinner outlives this run: only the fetch that set it may clear it.
		for (const f of loadingFields) {
			if (!open.has(f)) loadingFields.delete(f);
		}
		// Every errored field lacks fresh values, so it is always pending below and retried.
		errorByField.clear();

		const pending = openList.filter((f) => !valuesByField.has(f));
		if (pending.length === 0) return;
		for (const f of pending) loadingFields.add(f);

		fetchFieldValuesBulk({
			indexId: id,
			fields: pending,
			query: store.query,
			filters: store.filters,
			timeRange: store.timeRange,
			signal
		})
			.then((result) => {
				if (signal.aborted) return;
				for (const f of pending) {
					errorByField.delete(f);
					loadingFields.delete(f);
					const k = desiredKeys.get(f);
					if (k !== undefined) valuesByField.set(f, { key: k, values: result[f] ?? [] });
				}
			})
			.catch((err: unknown) => {
				if (signal.aborted) return;
				const msg = err instanceof Error ? err.message : 'Failed to load values';
				for (const f of pending) {
					errorByField.set(f, msg);
					loadingFields.delete(f);
				}
			});
	}

	// Debounced single-flight; the cleanup aborts the superseded run, so a late response can only
	// arrive on an aborted signal.
	$effect(() => {
		void triggerKey;
		void store.fieldsReady;
		const ctl = new AbortController();
		const timer = setTimeout(() => runOrchestrator(ctl.signal), VALUES_DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			ctl.abort();
		};
	});

	const normalized = $derived(searchTerm.trim().toLowerCase());

	const isOtelIndex = $derived(store.fieldConfig?.isOtel ?? false);
	const levels = $derived(store.levels);
	const fields = $derived(store.fields);
	const sample = $derived(store.fieldSample);

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

	const sections = $derived(
		buildFieldSections({
			fields,
			counts: sample.counts,
			pinned: pinnedFields,
			inUse: new Set([...store.activeFields, ...store.filters.map((f) => f.field)]),
			open: openFields,
			isOtel: isOtelIndex,
			search: normalized
		})
	);

	const items = $derived.by<PanelItem[]>(() => {
		const out: PanelItem[] = [];
		for (const section of sections) {
			if (section.fields.length === 0) continue;
			const indent = section.key !== 'top';
			if (section.key !== 'top') {
				const collapsed = normalized.length === 0 && groupsCollapsed[section.key];
				out.push({
					kind: 'header',
					key: `g:${section.key}`,
					group: section.key,
					label: section.label,
					collapsed
				});
				if (collapsed) continue;
			}
			for (const { field, label, count } of section.fields) {
				out.push({ kind: 'row', key: `f:${field.name}`, field, label, count, indent });
			}
		}
		return out;
	});

	let viewportEl = $state<HTMLElement | null>(null);
	let headerEl = $state<HTMLElement | null>(null);
	let scrollMargin = $state(0);

	const virtualizer = createVirtualizer<HTMLElement, HTMLElement>({
		count: items.length,
		getScrollElement: () => viewportEl,
		estimateSize: () => ROW_ESTIMATE,
		getItemKey: (index) => items[index]?.key ?? index,
		overscan: OVERSCAN,
		scrollMargin: 0
	});

	// The store replays its stale initial options on every re-subscribe, so hold one subscription
	// for the panel's lifetime instead of remounting the virtualizer with count 0.
	$effect(() => virtualizer.subscribe(() => {}));

	function measure(node: HTMLElement) {
		get(virtualizer).measureElement(node);
	}

	$effect(() => {
		const el = headerEl;
		if (el === null) {
			scrollMargin = 0;
			return;
		}
		const ro = new ResizeObserver(() => (scrollMargin = el.offsetHeight));
		ro.observe(el);
		return () => ro.disconnect();
	});

	$effect.pre(() => {
		const list = items;
		const margin = scrollMargin;
		const el = viewportEl;
		// Runs before new rows measure. A fresh getItemKey identity is what invalidates virtual-core's
		// measurements memo; without it a same-length reorder keeps the previous order's sizes.
		get(virtualizer).setOptions({
			count: list.length,
			scrollMargin: margin,
			getScrollElement: () => el,
			estimateSize: () => ROW_ESTIMATE,
			getItemKey: (index) => list[index]?.key ?? index,
			overscan: OVERSCAN
		});
	});

	$effect(() => {
		void normalized;
		void selectedIndex;
		if (viewportEl) viewportEl.scrollTop = 0;
	});

	/** A section header draws a rule unless the expanded row above it already closed with one. */
	function needsTopRule(index: number): boolean {
		const prev = items[index - 1];
		return prev !== undefined && (prev.kind !== 'row' || !openFields.has(prev.field.name));
	}

	const totalFieldMatches = $derived(sections.reduce((n, s) => n + s.fields.length, 0));
	const matchCount = $derived(filteredLevels.length + totalFieldMatches);
	const isAllEmpty = $derived(normalized.length > 0 && matchCount === 0);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			searchTerm = '';
			inputEl?.blur();
		}
	}

	function toggleGroup(key: CollapsibleKey) {
		groupsCollapsed[key] = !groupsCollapsed[key];
		if (!selectedIndex) return;
		const collapsed = Object.entries(groupsCollapsed)
			.filter(([, isCollapsed]) => isCollapsed)
			.map(([name]) => name);
		writeJSON(collapsedStorageKey(selectedIndex), collapsed);
	}
</script>

<div class="bg-base-100 flex h-full flex-col">
	<!-- Matches the 48px navigation/toolbar band; narrow explorers add a separate query row. -->
	<div
		class="border-line bg-base-100 sticky top-0 z-10 flex h-12 shrink-0 items-center border-b px-3"
	>
		<label class="input input-sm w-full gap-2">
			<Search class="text-subtle size-3.5" aria-hidden="true" />
			<input
				type="text"
				placeholder="Filter fields…"
				aria-label="Filter fields"
				bind:this={inputEl}
				bind:value={searchTerm}
				onkeydown={handleKeydown}
			/>
			{#if normalized && !isAllEmpty}
				<span class="text-subtle text-xs tabular-nums">{matchCount}</span>
			{/if}
		</label>
	</div>

	<div bind:this={viewportEl} class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
		{#if store.fieldsError}
			<div class="flex flex-col items-center gap-2 p-6 text-center">
				<p class="text-error text-xs">{store.fieldsError}</p>
				<p class="text-muted text-xs">Field list failed to load.</p>
				<button
					type="button"
					class="btn btn-ghost btn-xs mt-1"
					onclick={() => store.reloadFields()}
				>
					Retry
				</button>
			</div>
		{:else if isAllEmpty}
			<p class="text-subtle p-6 text-center text-xs">No matches</p>
		{:else}
			<!-- Non-virtualized content above the list; its height feeds the virtualizer's scrollMargin. -->
			<div bind:this={headerEl}>
				{#if (store.fieldConfig?.levelField ?? null) !== null}
					{#if store.histogramLoading}
						<section class="p-3">
							<p class="section-label mb-2">Levels</p>
							<div class="flex items-center justify-center py-2">
								<span class="loading loading-spinner loading-xs"></span>
							</div>
						</section>
					{:else if sortedLevels.length > 0}
						{@const levelField = store.fieldConfig?.levelField ?? null}
						{@const anyActiveForField =
							levelField !== null &&
							store.filters.some((f) => f.field === levelField && !f.exclude)}
						<section class="p-3">
							<p class="section-label mb-2">Levels</p>
							<ul class="space-y-0.5">
								{#each sortedLevels as level (level.name)}
									{@const isActive =
										levelField !== null && store.hasFilter(levelField, level.name, false)}
									{@const showFull = !anyActiveForField || isActive}
									<li>
										<button
											type="button"
											class="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-left text-xs transition-colors disabled:cursor-not-allowed"
											role="checkbox"
											aria-checked={isActive}
											disabled={levelField === null || level.name === UNKNOWN_LEVEL}
											title={level.name === UNKNOWN_LEVEL
												? 'Severity is missing or blank'
												: undefined}
											onclick={() => store.toggleLevelFilter(level.name)}
										>
											{#if showFull}
												<span
													class="status shrink-0"
													style="background-color: {levelColor(level.name)};"
													aria-hidden="true"
												></span>
											{:else}
												<span class="status shrink-0" aria-hidden="true"></span>
											{/if}
											<span
												class="min-w-0 flex-1 truncate transition-colors {showFull
													? ''
													: 'text-subtle'}"
											>
												{level.name}
											</span>
											<span class="text-subtle shrink-0 text-right tabular-nums">
												{level.count === null ? '—' : level.count.toLocaleString()}
											</span>
										</button>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{/if}
			</div>

			{#if store.fieldsLoading && fields.length === 0}
				<div class="text-subtle flex items-center justify-center gap-2 p-6 text-xs">
					<span class="loading loading-spinner loading-xs"></span>
					Loading fields…
				</div>
			{:else}
				<div
					class="border-line relative w-full {scrollMargin > 0 ? 'border-t' : ''}"
					style="height: {$virtualizer.getTotalSize()}px;"
				>
					{#each $virtualizer.getVirtualItems() as virtualItem (items[virtualItem.index]?.key ?? virtualItem.index)}
						{@const item = items[virtualItem.index]}
						{#if item}
							<div
								{@attach measure}
								data-index={virtualItem.index}
								class="absolute top-0 left-0 w-full"
								style="transform: translateY({virtualItem.start - scrollMargin}px);"
							>
								{#if item.kind === 'header'}
									<button
										type="button"
										class="border-line flex w-full items-center gap-1 px-3 py-1.5 {needsTopRule(
											virtualItem.index
										)
											? 'border-t'
											: ''}"
										aria-expanded={!item.collapsed}
										disabled={normalized.length > 0}
										onclick={() => toggleGroup(item.group)}
									>
										{#if item.collapsed}
											<ChevronRight class="text-muted size-3 shrink-0" aria-hidden="true" />
										{:else}
											<ChevronDown class="text-muted size-3 shrink-0" aria-hidden="true" />
										{/if}
										<span class="flex-1 text-left text-xs font-medium">{item.label}</span>
									</button>
								{:else}
									<SidebarFieldRow
										field={item.field}
										{store}
										open={openFields.has(item.field.name)}
										onToggle={() => toggleOpen(item.field.name)}
										values={valuesByField.get(item.field.name)?.values ?? null}
										loading={loadingFields.has(item.field.name)}
										error={errorByField.get(item.field.name) ?? null}
										indented={item.indent}
										label={item.label}
										sampleCount={item.count}
										sampleTotal={sample.total}
										pinned={pinnedFields.has(item.field.name)}
										onPin={() => togglePin(item.field.name)}
										bind:valueSearch={
											() => valueSearchByField.get(item.field.name) ?? '',
											(v) => valueSearchByField.set(item.field.name, v)
										}
										bind:showCount={
											() => showCountByField.get(item.field.name) ?? FIELD_VALUES_INITIAL_SHOW,
											(v) => showCountByField.set(item.field.name, v)
										}
									/>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
