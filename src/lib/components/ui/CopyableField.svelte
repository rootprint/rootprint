<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	let {
		value,
		ariaLabel
	}: {
		value: string;
		ariaLabel?: string;
	} = $props();
</script>

<div class="flex items-center gap-2">
	<input
		type="text"
		class="input-bordered input input-sm flex-1 font-mono text-xs"
		readonly
		{value}
		aria-label={ariaLabel}
	/>
	<CopyButton text={value} class="btn btn-sm btn-neutral">
		{#snippet children({ copied })}
			{copied ? 'Copied!' : 'Copy'}
		{/snippet}
	</CopyButton>
</div>
