<script lang="ts">
	type Props = {
		value: number;
		options: readonly number[];
		onChange: (next: number) => void;
	};

	let { value, options, onChange }: Props = $props();
</script>

<div class="flex items-center gap-2" aria-label="Rows per page">
	<span class="text-muted text-xs">Rows</span>
	<div class="border-line divide-line flex divide-x overflow-hidden rounded border">
		{#each options as option (option)}
			<button
				type="button"
				class="h-7 min-w-9 px-2 text-xs tabular-nums transition-colors {value === option
					? 'bg-base-content text-base-100'
					: 'text-muted hover:bg-base-200 hover:text-base-content'}"
				aria-pressed={value === option}
				onclick={() => onChange(option)}
			>
				{option}
			</button>
		{/each}
	</div>
</div>
