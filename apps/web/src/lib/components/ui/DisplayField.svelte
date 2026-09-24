<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		value,
		ariaLabel,
		action
	}: {
		value: string;
		ariaLabel: string;
		action?: Snippet;
	} = $props();
</script>

<label class="input input-sm border-line bg-base-200/40 w-full">
	<input {value} disabled class="text-subtle" aria-label={ariaLabel} />
	{#if action}{@render action()}{/if}
</label>
