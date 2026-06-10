<script lang="ts">
	import { Play, Share2 } from 'lucide-svelte';
	import TimeRangePicker from './TimeRangePicker.svelte';
	import ViewsDropdown from './ViewsDropdown.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';

	let { store }: { store: SearchStore } = $props();

	let queryInput = $state(store.query);
	let focused = $state(false);

	$effect(() => {
		if (!focused) queryInput = store.query;
	});

	function commitQuery() {
		if (queryInput !== store.query) {
			store.runQuery(queryInput);
		}
	}

	function shareLink() {
		void copyWithToast(window.location.href, 'Link copied', 'Failed to copy link');
	}
</script>

<div class="border-line bg-base-100 flex h-12 items-center gap-2 border-b px-3">
	<ViewsDropdown {store} />

	<select
		class="select select-sm w-auto min-w-0 font-mono text-xs"
		value={store.selectedIndex}
		onchange={(e) => store.handleIndexChange((e.currentTarget as HTMLSelectElement).value)}
	>
		{#each store.indexes as idx (idx.id)}
			<option value={idx.id}>{idx.name}</option>
		{/each}
	</select>

	<input
		type="text"
		class="input input-sm min-w-0 flex-1 font-mono"
		placeholder="Search logs…"
		bind:value={queryInput}
		onfocus={() => (focused = true)}
		onblur={() => {
			focused = false;
			commitQuery();
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter') commitQuery();
		}}
	/>

	<TimeRangePicker
		value={store.timeRange}
		onChange={(next) => store.navigateQuery({ timeRange: next }, { push: true })}
	/>

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class="btn btn-sm btn-ghost"
			aria-label="Share"
			title="Share"
			onclick={shareLink}
		>
			<Share2 class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			class="btn btn-sm btn-primary"
			aria-label="Run query"
			title="Run query"
			onclick={() => store.runQuery(queryInput)}
		>
			<Play class="h-3.5 w-3.5" />
			Run
		</button>
	</div>
</div>
