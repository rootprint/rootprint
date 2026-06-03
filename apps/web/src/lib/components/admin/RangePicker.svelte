<script lang="ts">
	import type { Window } from '$lib/api/activity';

	type Props = {
		value: Window;
		onChange: (next: Window) => void;
	};

	let { value, onChange }: Props = $props();

	const OPTIONS: readonly Window[] = ['24h', '7d', '30d'];
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
