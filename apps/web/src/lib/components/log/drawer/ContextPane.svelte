<script lang="ts">
	import { tick } from 'svelte';
	import { ArrowUp, ArrowDown } from 'lucide-svelte';

	import ContextChipBar from './context/ContextChipBar.svelte';
	import ContextRow from './context/ContextRow.svelte';
	import { ContextLoader } from './context/context-loader.svelte';
	import type { ContextEntry, LogHit } from '$lib/types';
	import type { SearchStore } from '$lib/stores/search.svelte';

	let {
		hit,
		store,
		onCloseDrawer
	}: {
		hit: LogHit;
		store: SearchStore;
		onCloseDrawer: () => void;
	} = $props();

	let loader = $state<ContextLoader | null>(null);
	let scrollEl: HTMLDivElement | null = $state(null);
	let topSentinel: HTMLDivElement | null = $state(null);
	let bottomSentinel: HTMLDivElement | null = $state(null);

	let expandedKeys = $state<Set<string>>(new Set());

	let anchorVisible = $state(true);
	let anchorAbove = $state(false);

	$effect(() => {
		const indexId = store.selectedIndex;
		const fieldConfig = store.fieldConfig;
		if (!indexId || !fieldConfig) return;
		const next = new ContextLoader(hit, indexId, fieldConfig);
		loader = next;
		expandedKeys = new Set();
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
						void localLoader.loadMoreBefore();
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
	async function runLoadMoreAfterWith(l: ContextLoader): Promise<void> {
		if (!scrollEl) return;
		const before = { top: scrollEl.scrollTop, height: scrollEl.scrollHeight };
		await l.loadMoreAfter();
		await tick();
		if (!scrollEl) return;
		const delta = scrollEl.scrollHeight - before.height;
		if (delta > 0) scrollEl.scrollTop = before.top + delta;
	}

	function toggleEntry(entry: ContextEntry): void {
		const next = new Set(expandedKeys);
		if (next.has(entry.key)) next.delete(entry.key);
		else next.add(entry.key);
		expandedKeys = next;
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
		<ContextChipBar
			chips={l.chips}
			disabled={l.loadingInitial}
			onRemove={(f) => void l.removeChip(f)}
			{onOpenAsSearch}
		/>

		{#if l.error}
			<p class="text-warning px-3 py-2 text-sm">{l.error}</p>
		{/if}

		{#if l.loadingInitial}
			<div class="flex flex-1 items-center justify-center">
				<span class="loading loading-spinner loading-sm"></span>
			</div>
		{:else}
			<div class="relative min-h-0 flex-1">
				<div bind:this={scrollEl} class="absolute inset-0 overflow-y-auto">
					<!-- Top sentinel: newer side -->
					<div bind:this={topSentinel}>
						{#if l.loadingMoreAfter}
							<div class="flex items-center justify-center py-2">
								<span class="loading loading-spinner loading-xs"></span>
							</div>
						{:else if l.noMoreAfter}
							<p
								class="border-line text-base-content/40 border-b border-dashed py-2 text-center text-[10px]"
							>
								No newer logs
							</p>
						{/if}
					</div>

					{#each l.entries as entry (entry.key)}
						<ContextRow
							{entry}
							fieldConfig={l.fieldConfig}
							isAnchor={entry.isAnchor}
							expanded={expandedKeys.has(entry.key)}
							onToggle={() => toggleEntry(entry)}
						/>
					{/each}

					<!-- Bottom sentinel: older side -->
					<div bind:this={bottomSentinel}>
						{#if l.loadingMoreBefore}
							<div class="flex items-center justify-center py-2">
								<span class="loading loading-spinner loading-xs"></span>
							</div>
						{:else if l.noMoreBefore}
							<p
								class="border-line text-base-content/40 border-t border-dashed py-2 text-center text-[10px]"
							>
								No older logs
							</p>
						{/if}
					</div>
				</div>

				{#if !anchorVisible}
					<button
						type="button"
						class="btn btn-sm btn-primary absolute right-4 bottom-4 z-10 gap-1 rounded-full shadow-lg"
						onclick={scrollToAnchor}
					>
						{#if anchorAbove}
							<ArrowUp class="h-3 w-3" />
						{:else}
							<ArrowDown class="h-3 w-3" />
						{/if}
						Back to hit
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}
