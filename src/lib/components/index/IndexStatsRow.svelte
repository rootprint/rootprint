<script lang="ts">
	type StatCard = {
		label: string;
		value: string;
		caption: string;
	};

	const cards: StatCard[] = [
		{ label: 'Ingestion · 24h', value: '—', caption: '—' },
		{ label: 'Index size', value: '—', caption: '—' },
		{ label: 'Metric · Placeholder', value: '—', caption: 'TBD' },
		{ label: 'Metric · Placeholder', value: '—', caption: 'TBD' }
	];
</script>

<div
	class="grid grid-cols-1 overflow-hidden rounded-box border border-base-300 md:grid-cols-2 lg:grid-cols-4"
>
	{#each cards as card, i (i)}
		<div
			class="bg-base-200/40 px-4 py-3 not-last:border-b not-last:border-base-300 lg:not-last:border-r lg:not-last:border-b-0"
		>
			<div class="text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
				{card.label}
			</div>
			<div class="mt-1 text-2xl font-semibold text-base-content/80">{card.value}</div>
			<div class="mt-1 text-xs text-base-content/50">{card.caption}</div>
		</div>
	{/each}
</div>
