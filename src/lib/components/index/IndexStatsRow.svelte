<script lang="ts">
	import type { IndexStatsCard } from '$lib/types';

	import IndexStatsRowError from './IndexStatsRowError.svelte';
	import IndexStatsRowLoaded from './IndexStatsRowLoaded.svelte';
	import IndexStatsRowSkeleton from './IndexStatsRowSkeleton.svelte';

	let { stats }: { stats: Promise<IndexStatsCard | null> } = $props();
</script>

<div
	class="grid grid-cols-1 overflow-hidden rounded-t-2xl border border-base-300 md:grid-cols-2 lg:grid-cols-4"
>
	{#await stats}
		<IndexStatsRowSkeleton />
	{:then resolved}
		{#if resolved}
			<IndexStatsRowLoaded stats={resolved} />
		{:else}
			<IndexStatsRowError />
		{/if}
	{/await}
</div>
