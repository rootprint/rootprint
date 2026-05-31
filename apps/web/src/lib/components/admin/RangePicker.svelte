<script module lang="ts">
	export type Range = '24h' | '7d' | '30d';

	const DAY_MS = 24 * 60 * 60 * 1000;
	const RANGE_TO_MS: Record<Range, number> = {
		'24h': DAY_MS,
		'7d': 7 * DAY_MS,
		'30d': 30 * DAY_MS
	};

	export function rangeToSpanMs(r: Range): number {
		return RANGE_TO_MS[r];
	}
</script>

<script lang="ts">
	type Props = {
		value: Range;
		onChange: (next: Range) => void;
	};

	let { value, onChange }: Props = $props();

	const OPTIONS: readonly Range[] = ['24h', '7d', '30d'];
</script>

<div class="border-line inline-flex rounded border text-xs" role="group">
	{#each OPTIONS as opt (opt)}
		<button
			type="button"
			class="px-3 py-1 transition-colors {value === opt
				? 'bg-base-200 text-base-content'
				: 'text-base-content/60 hover:text-base-content hover:bg-base-200/60'}"
			onclick={() => onChange(opt)}
		>
			{opt}
		</button>
	{/each}
</div>
