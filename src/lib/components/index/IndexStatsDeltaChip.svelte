<script lang="ts">
	let { deltaPct }: { deltaPct: number | null } = $props();

	type Tone = 'up' | 'down' | 'flat';

	const tone: Tone | null = $derived.by(() => {
		if (deltaPct == null) return null;
		if (deltaPct > 1) return 'up';
		if (deltaPct < -1) return 'down';
		return 'flat';
	});

	const arrow = $derived(tone === 'up' ? '↑' : tone === 'down' ? '↓' : '→');

	const magnitude = $derived(deltaPct == null ? 0 : Math.abs(deltaPct));

	const classes = $derived(
		tone === 'up'
			? 'bg-success/15 text-success'
			: tone === 'down'
				? 'bg-error/15 text-error'
				: 'bg-base-content/10 text-base-content/60'
	);
</script>

{#if tone}
	<span
		class="mr-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold {classes}"
	>
		<span>{arrow}</span>
		<span>{magnitude.toFixed(1)}%</span>
	</span>
{/if}
