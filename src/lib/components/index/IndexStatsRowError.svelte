<script lang="ts">
	import { STATS_LABELS_ORDERED } from '$lib/constants/index-stats';

	import IndexStatsCell from './IndexStatsCell.svelte';
</script>

{#each STATS_LABELS_ORDERED as label, i (label)}
	<IndexStatsCell
		{label}
		value="—"
		caption={i === STATS_LABELS_ORDERED.length - 1 ? 'Stats unavailable — check server logs' : ''}
		captionTone={i === STATS_LABELS_ORDERED.length - 1 ? 'warn' : 'default'}
	/>
{/each}
