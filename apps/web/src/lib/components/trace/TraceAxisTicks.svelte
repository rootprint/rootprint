<script lang="ts">
	import type { TraceAxis } from '$lib/utils/trace-axis';

	let { ticks }: { ticks: TraceAxis['ticks'] } = $props();
</script>

{#each ticks as tick (tick.pct)}
	<span
		class={[
			'text-base-content/50 absolute top-0 font-mono text-[10px]',
			tick.pct > 0 && '-translate-x-1/2'
		]}
		style={`left:${tick.pct}%`}
	>
		{tick.label}
	</span>
{/each}
