<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	import ContextScopeBar from './context/ContextScopeBar.svelte';
	import LogRow from '../LogRow.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import { ContextLoader, seedChipsFromIndex } from './context/context-loader.svelte';
	import { getByPath } from '$lib/components/logs/get-by-path';
	import {
		buildGridTemplate,
		computeColumnWidths,
		computeFieldWidth
	} from '$lib/components/logs/column-width';
	import { readStringArray, writeJSON } from '$lib/utils/safe-storage';
	import type { LogHit } from '$lib/types';
	import type { SearchStore } from '$lib/components/logs/search.svelte';

	let {
		hit,
		store,
		onCloseDrawer,
		onReplaceHit
	}: {
		hit: LogHit;
		store: SearchStore;
		onCloseDrawer: () => void;
		onReplaceHit: (hit: LogHit) => void;
	} = $props();

	let loader = $state<ContextLoader | null>(null);
	let scrollEl: HTMLDivElement | null = $state(null);
	let topSentinel: HTMLDivElement | null = $state(null);
	let bottomSentinel: HTMLDivElement | null = $state(null);

	let anchorVisible = $state(true);
	let anchorAbove = $state(false);

	const storageKey = (indexId: string) => `rootprint:context-fields:${indexId}`;

	function readStoredFields(indexId: string | null): string[] {
		return indexId ? readStringArray(storageKey(indexId)) : [];
	}

	/**
	 * Fields the user toggled on; empty = "All" (unscoped). AND-joined into the context query.
	 * Read from storage once at mount: safe because the drawer unmounts on index change
	 * (+page.svelte clears selectedLog), so this component never survives an index switch.
	 */
	let selectedFields = $state<string[]>(readStoredFields(untrack(() => store.selectedIndex)));

	function hasValue(field: string): boolean {
		const v = getByPath(hit.raw, field);
		return v !== undefined && v !== null && !(typeof v === 'string' && v.length === 0);
	}

	const fieldTabs = $derived(
		(store.fieldConfig?.contextFields ?? []).map((field) => ({
			field,
			disabled: !hasValue(field)
		}))
	);

	const entryRaws = $derived(loader ? loader.entries.map((e) => e.raw) : []);
	const messageField = $derived(store.fieldConfig?.messageField);
	const columnWidths = $derived(computeColumnWidths(entryRaws, store.activeFields));
	const messageWidth = $derived(
		messageField && store.activeFields.includes(messageField)
			? computeFieldWidth(entryRaws, messageField)
			: 0
	);
	const gridTemplate = $derived(
		buildGridTemplate(store.activeFields, columnWidths, messageField, messageWidth, store.lineWrap)
	);

	function setSelectedFields(fields: string[]): void {
		selectedFields = fields;
		if (store.selectedIndex) writeJSON(storageKey(store.selectedIndex), fields);
		if (loader) void loader.setChips(seedChipsFromIndex(hit.raw, fields));
	}

	$effect(() => {
		const indexId = store.selectedIndex;
		const fieldConfig = store.fieldConfig;
		const anchor = hit;
		if (!indexId || !fieldConfig) return;
		const contextFields = new Set(fieldConfig.contextFields);
		// Re-anchor keeps the toggled fields, minus any removed from config or missing on the new anchor.
		// selectedFields is untracked so toggling doesn't rebuild the loader (setChips refetches instead).
		const kept = untrack(() => {
			const fields = selectedFields.filter((field) => contextFields.has(field) && hasValue(field));
			if (fields.length !== selectedFields.length) selectedFields = fields;
			return fields;
		});
		const next = new ContextLoader(
			anchor,
			indexId,
			fieldConfig,
			seedChipsFromIndex(anchor.raw, kept)
		);
		loader = next;
		void next.init();
		return () => {
			next.dispose();
		};
	});

	// Scroll the anchor into view after every fresh initial fetch (drawer-open and chip-change both bump initEpoch).
	$effect(() => {
		if (!loader || !scrollEl) return;
		// Subscribe to initEpoch so this effect re-runs after each fresh fetch.
		const epoch = loader.initEpoch;
		if (epoch === 0) return; // not yet initialized
		void (async () => {
			await tick();
			const el = scrollEl?.querySelector<HTMLElement>('[data-anchor="true"]');
			if (el) el.scrollIntoView({ block: 'center' });
		})();
	});

	// rootMargin 1500px mirrors SCROLL_TRIGGER_PX on the main results page: the next page loads while the sentinel is still 1500px away, so the user never sees a spinner.
	$effect(() => {
		if (!scrollEl || !loader) return;
		const localLoader = loader;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					if (entry.target === topSentinel) {
						void runLoadMoreAfterWith(localLoader);
					} else if (entry.target === bottomSentinel) {
						void localLoader.loadMore('before');
					}
				}
			},
			{ root: scrollEl, rootMargin: '1500px 0px 1500px 0px', threshold: 0 }
		);
		if (topSentinel) observer.observe(topSentinel);
		if (bottomSentinel) observer.observe(bottomSentinel);
		return () => observer.disconnect();
	});

	// Tracks anchor visibility so the floating "Back to hit" button can appear when it scrolls off-screen.
	$effect(() => {
		if (!scrollEl || !loader) return;
		const epoch = loader.initEpoch;
		if (epoch === 0) return; // anchor not yet in DOM
		// Optimistically reset so a previous off-screen state doesn't bleed into the
		// new loader's initial render before the observer fires its first callback.
		anchorVisible = true;
		anchorAbove = false;
		let observer: IntersectionObserver | null = null;
		let cancelled = false;
		void (async () => {
			await tick();
			if (cancelled || !scrollEl) return;
			const el = scrollEl.querySelector<HTMLElement>('[data-anchor="true"]');
			if (!el) return;
			observer = new IntersectionObserver(
				(entries) => {
					const entry = entries[0];
					if (!entry) return;
					anchorVisible = entry.isIntersecting;
					const rootBounds = entry.rootBounds;
					if (!entry.isIntersecting && rootBounds) {
						anchorAbove = entry.boundingClientRect.bottom < rootBounds.top;
					}
				},
				{ root: scrollEl, threshold: 0 }
			);
			observer.observe(el);
		})();
		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	});

	/** Prepending newer rows shifts scrollHeight; restore visual scroll position. */
	async function runLoadMoreAfterWith(l: ContextLoader, retry = false): Promise<void> {
		if (!scrollEl) return;
		const before = { top: scrollEl.scrollTop, height: scrollEl.scrollHeight };
		await l.loadMore('after', retry);
		await tick();
		if (!scrollEl) return;
		const delta = scrollEl.scrollHeight - before.height;
		if (delta > 0) scrollEl.scrollTop = before.top + delta;
	}

	function scrollToAnchor(): void {
		const el = scrollEl?.querySelector<HTMLElement>('[data-anchor="true"]');
		el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	function onOpenAsSearch(): void {
		if (!loader) return;
		const { query, start, end } = loader.getSearchHandoff();
		store.navigateQuery(
			{
				query,
				timeRange: { type: 'absolute', start, end },
				filters: []
			},
			{ push: true }
		);
		onCloseDrawer();
	}
</script>

{#if loader}
	{@const l = loader}
	<div class="flex h-full flex-col">
		<ContextScopeBar
			selected={selectedFields}
			{fieldTabs}
			indexId={l.indexId}
			disabled={l.loadingInitial}
			onChange={setSelectedFields}
			{onOpenAsSearch}
		/>

		{#if l.error}
			<p class="text-warning-ink px-3 py-2 text-sm">{l.error}</p>
		{/if}

		{#if l.loadingInitial}
			<div class="flex flex-1 items-center justify-center">
				<span class="loading loading-spinner loading-sm"></span>
			</div>
		{:else}
			<div class="relative min-h-0 flex-1">
				<div bind:this={scrollEl} class="absolute inset-0 overflow-x-auto overflow-y-auto">
					<!-- Top sentinel: newer side -->
					<div bind:this={topSentinel}>
						{#if l.after.loading}
							<div class="flex items-center justify-center py-2">
								<span class="loading loading-spinner loading-xs"></span>
							</div>
						{:else if l.after.error}
							<div class="px-3 py-2">
								<PanelError
									message="Couldn't load newer logs"
									error={l.after.error}
									retry={() => runLoadMoreAfterWith(l, true)}
								/>
							</div>
						{:else if l.after.limited}
							<p class="text-warning-ink px-3 py-2 text-center text-xs">
								Newer context reached the pagination limit. Narrow the scope to see more logs.
							</p>
						{:else if l.after.noMore}
							<p class="border-line text-subtle border-b border-dashed py-2 text-center text-xs">
								No newer logs
							</p>
						{/if}
					</div>

					{#each l.entries as entry (entry.key)}
						<LogRow
							hit={entry}
							columns={store.activeFields}
							{gridTemplate}
							{messageField}
							lineWrap={store.lineWrap}
							isAnchor={entry.isAnchor}
							onActivate={() => onReplaceHit(entry)}
						/>
					{/each}

					<!-- Bottom sentinel: older side -->
					<div bind:this={bottomSentinel}>
						{#if l.before.loading}
							<div class="flex items-center justify-center py-2">
								<span class="loading loading-spinner loading-xs"></span>
							</div>
						{:else if l.before.error}
							<!-- pb-16 keeps the Retry button clear of the floating "Back to hit" pill, which sits in this same bottom-right corner. -->
							<div class="px-3 pt-2 pb-16">
								<PanelError
									message="Couldn't load older logs"
									error={l.before.error}
									retry={() => void l.loadMore('before', true)}
								/>
							</div>
						{:else if l.before.limited}
							<p class="text-warning-ink px-3 pt-2 pb-16 text-center text-xs">
								Older context reached the pagination limit. Narrow the scope to see more logs.
							</p>
						{:else if l.before.noMore}
							<p class="border-line text-subtle border-t border-dashed py-2 text-center text-xs">
								No older logs
							</p>
						{/if}
					</div>
				</div>

				{#if !anchorVisible}
					<button
						type="button"
						class="btn btn-sm btn-primary absolute right-4 bottom-4 z-10 gap-1 shadow-lg"
						onclick={scrollToAnchor}
					>
						{#if anchorAbove}
							<ArrowUp class="size-3" aria-hidden="true" />
						{:else}
							<ArrowDown class="size-3" aria-hidden="true" />
						{/if}
						Back to hit
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}
