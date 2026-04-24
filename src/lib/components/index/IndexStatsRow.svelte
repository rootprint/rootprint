<script lang="ts">
	import type { IndexStatsCard } from '$lib/types';

	import IndexStatsRowError from './IndexStatsRowError.svelte';
	import IndexStatsRowLoaded from './IndexStatsRowLoaded.svelte';
	import IndexStatsRowSkeleton from './IndexStatsRowSkeleton.svelte';

	let { stats }: { stats: Promise<IndexStatsCard | null> } = $props();
</script>

{#await stats}
	<IndexStatsRowSkeleton />
{:then resolved}
	{#if resolved}
		<IndexStatsRowLoaded stats={resolved} />
	{:else}
		<IndexStatsRowError />
	{/if}
{/await}
