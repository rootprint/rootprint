<script lang="ts">
	let { deltaPct }: { deltaPct: number | null } = $props();

	type Tone = 'up' | 'down' | 'flat';

	const TONE_META: Record<Tone, { arrow: string; classes: string }> = {
		up: { arrow: '↑', classes: 'bg-success/15 text-success' },
		down: { arrow: '↓', classes: 'bg-error/15 text-error' },
		flat: { arrow: '→', classes: 'bg-base-content/10 text-base-content/60' }
	};

	const tone: Tone | null = $derived.by(() => {
		if (deltaPct == null) return null;
		if (deltaPct > 1) return 'up';
		if (deltaPct < -1) return 'down';
		return 'flat';
	});

	const magnitude = $derived(deltaPct == null ? 0 : Math.abs(deltaPct));
</script>

{#if tone}
	<span
		class={[
			'mr-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
			TONE_META[tone].classes
		]}
	>
		<span>{TONE_META[tone].arrow}</span>
		<span>{magnitude.toFixed(1)}%</span>
	</span>
{/if}
