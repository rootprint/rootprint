<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'default' | 'warn' | 'err' | 'ok';

	let {
		label,
		value,
		caption = '',
		captionTone = 'default',
		ring = false,
		children
	}: {
		label: string;
		value: string;
		caption?: string;
		captionTone?: Tone;
		ring?: boolean;
		children?: Snippet;
	} = $props();

	const captionClass = $derived(
		captionTone === 'warn'
			? 'text-warning'
			: captionTone === 'err'
				? 'text-error'
				: captionTone === 'ok'
					? 'text-success'
					: 'text-base-content/50'
	);
</script>

<div
	class="flex flex-col gap-1 bg-base-200/40 px-4 py-3 not-last:border-b not-last:border-base-300 lg:not-last:border-r lg:not-last:border-b-0 {ring
		? 'ring-1 ring-warning/40 ring-inset'
		: ''}"
>
	<div class="text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
		{label}
	</div>
	<div class="mt-1 text-2xl font-semibold text-base-content/80">{value}</div>
	<div class="mt-1 flex items-center text-xs {captionClass}">
		{#if children}{@render children()}{/if}
		<span>{caption}</span>
	</div>
</div>
