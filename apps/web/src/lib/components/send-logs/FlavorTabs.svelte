<script lang="ts">
	import { page } from '$app/state';
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';
	import type { Flavor } from '$lib/send-logs/types';

	let { flavors, active }: { flavors: Flavor[]; active: string } = $props();

	const [send, receive] = crossfade({
		duration: 200,
		easing: cubicInOut
	});

	function hrefFor(flavorId: string): string {
		const url = new URL(page.url);
		url.searchParams.set('flavor', flavorId);
		return url.pathname + url.search;
	}
</script>

<div role="tablist" aria-label="Integration flavor" class="border-base-content/10 mt-6 flex gap-1">
	{#each flavors as flavor (flavor.id)}
		{@const isActive = flavor.id === active}
		<a
			role="tab"
			aria-selected={isActive}
			aria-current={isActive ? 'page' : undefined}
			href={hrefFor(flavor.id)}
			data-sveltekit-replacestate
			class={[
				'relative flex h-10 items-center px-3 text-xs transition-colors',
				isActive ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
			]}
		>
			{flavor.label}
			{#if isActive}
				<span
					in:receive={{ key: 'flavor-tab-indicator' }}
					out:send={{ key: 'flavor-tab-indicator' }}
					class="bg-base-content absolute right-0 -bottom-px left-0 h-0.5"
				></span>
			{/if}
		</a>
	{/each}
</div>
