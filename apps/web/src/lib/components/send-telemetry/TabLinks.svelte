<script lang="ts">
	import { page } from '$app/state';
	import type { TabItem } from '$lib/send-telemetry/types';

	let {
		items,
		active,
		param,
		ariaLabel
	}: { items: TabItem[]; active: string; param: string; ariaLabel: string } = $props();

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
				'tab-underline flex h-10 items-center px-3 text-xs transition-colors',
				isActive ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
			]}
		>
			{item.label}
		</a>
	{/each}
</div>
