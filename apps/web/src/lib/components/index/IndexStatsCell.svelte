<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'default' | 'warn' | 'err' | 'ok';

	const TONE_CLASS: Record<Tone, string> = {
		default: 'text-base-content/50',
		warn: 'text-warning',
		err: 'text-error',
		ok: 'text-success'
	};

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
</script>

<div
	class={[
		'flex flex-col gap-1 bg-base-200/40 px-4 py-3 not-last:border-b not-last:border-base-300 lg:not-last:border-r lg:not-last:border-b-0',
		ring && 'ring-1 ring-warning/40 ring-inset'
	]}
>
	<div class="text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
		{label}
	</div>
	<div class="mt-1 text-2xl font-semibold text-base-content/80">{value}</div>
	<div class={['mt-1 flex items-center text-xs', TONE_CLASS[captionTone]]}>
		{#if children}{@render children()}{/if}
		<span>{caption}</span>
	</div>
</div>
