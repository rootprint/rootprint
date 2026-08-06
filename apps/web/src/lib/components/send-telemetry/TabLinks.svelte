<script lang="ts">
	import { page } from '$app/state';
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import type { TabItem } from '$lib/send-telemetry/types';

	let {
		items,
		active,
		param,
		ariaLabel
	}: { items: TabItem[]; active: string; param: string; ariaLabel: string } = $props();

	const [send, receive] = crossfade({
		duration: 200,
		easing: cubicInOut
	});

	function hrefFor(id: string): string {
		const url = new URL(page.url);
		url.searchParams.set(param, id);
		return url.pathname + url.search;
	}
</script>

<div role="tablist" aria-label={ariaLabel} class="border-base-content/10 mt-6 flex gap-1">
	{#each items as item (item.id)}
		{@const isActive = item.id === active}
		<a
			role="tab"
			aria-selected={isActive}
			aria-current={isActive ? 'page' : undefined}
			href={hrefFor(item.id)}
			data-sveltekit-replacestate
			class={[
				'relative flex h-10 items-center px-3 text-xs transition-colors',
				isActive ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
			]}
		>
			{item.label}
			{#if isActive}
				<span
					in:receive={{ key: `${param}-tab-indicator` }}
					out:send={{ key: `${param}-tab-indicator` }}
					class="bg-base-content absolute right-0 -bottom-px left-0 h-0.5"
				></span>
			{/if}
		</a>
	{/each}
</div>
