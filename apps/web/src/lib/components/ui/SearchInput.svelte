<script lang="ts">
	import { Search } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import type { ClassValue, HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		ref = $bindable(null),
		label,
		class: className = 'flex-1',
		inputClass,
		children,
		...rest
	}: Omit<HTMLInputAttributes, 'value' | 'class'> & {
		value: string;
		ref?: HTMLInputElement | null;
		label: string;
		class?: ClassValue;
		inputClass?: ClassValue;
		children?: Snippet;
	} = $props();
</script>

<label class={['input input-sm', className]}>
	<Search class="text-muted size-3.5 shrink-0" aria-hidden="true" />
	<input type="search" aria-label={label} class={inputClass} {...rest} bind:value bind:this={ref} />
	{@render children?.()}
</label>
