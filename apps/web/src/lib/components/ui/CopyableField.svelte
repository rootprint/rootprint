<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	let {
		value,
		ariaLabel
	}: {
		value: string;
		ariaLabel?: string;
	} = $props();

	const buttonAriaLabel = $derived(`Copy ${(ariaLabel ?? 'value').toLowerCase()}`);
</script>

<div class="flex items-center gap-2">
	<input
		type="text"
		class="input flex-1 font-mono text-xs"
		readonly
		{value}
		aria-label={ariaLabel}
	/>
	<CopyButton text={value} class="btn btn-sm btn-neutral" aria-label={buttonAriaLabel}
		>Copy</CopyButton
	>
</div>
