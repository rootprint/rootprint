<script lang="ts">
	import { STATS_LABELS_ORDERED } from '$lib/constants/index-stats';

	import IndexStatsCell from './IndexStatsCell.svelte';
</script>

<div
	class="grid grid-cols-1 overflow-hidden rounded-t-2xl border border-base-300 md:grid-cols-2 lg:grid-cols-4"
>
	{#each STATS_LABELS_ORDERED as label, i (label)}
		<IndexStatsCell
			{label}
			value="—"
			caption={i === STATS_LABELS_ORDERED.length - 1 ? 'Stats unavailable — check server logs' : ''}
			captionTone={i === STATS_LABELS_ORDERED.length - 1 ? 'warn' : 'default'}
		/>
	{/each}
</div>
