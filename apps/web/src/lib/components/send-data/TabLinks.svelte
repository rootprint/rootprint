<script lang="ts">
	import { page } from '$app/state';
	import type { TabItem } from '$lib/components/send-data/types';

	let {
		items,
		active,
		param,
		ariaLabel,
		segmented = false
	}: {
		items: TabItem[];
		active: string;
		param: string;
		ariaLabel: string;
		/** Button-group look for a secondary switch, so it can't be mistaken for the signal tabs. */
		segmented?: boolean;
	} = $props();

	function hrefFor(id: string): string {
		const url = new URL(page.url);
		url.searchParams.set(param, id);
		return url.pathname + url.search;
	}
</script>

<div role="tablist" aria-label={ariaLabel} class={segmented ? 'join' : 'flex gap-1'}>
	{#each items as item (item.id)}
		{@const isActive = item.id === active}
		<a
			role="tab"
			aria-selected={isActive}
			aria-current={isActive ? 'page' : undefined}
			href={hrefFor(item.id)}
			data-sveltekit-replacestate
			class={segmented
				? ['btn btn-xs join-item', isActive ? 'btn-neutral' : 'btn-ghost border-line']
				: [
						'tab-underline flex h-10 items-center px-3 text-xs transition-colors',
						isActive ? 'text-base-content' : 'text-muted hover:text-base-content'
					]}
		>
			{item.label}
		</a>
	{/each}
</div>
