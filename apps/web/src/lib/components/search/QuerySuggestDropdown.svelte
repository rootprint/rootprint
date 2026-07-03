<script lang="ts">
	import { Tag, Text } from 'lucide-svelte';
	import type { QuerySuggestion } from '$lib/types';

	let {
		items,
		kind,
		highlight,
		onPick
	}: {
		items: QuerySuggestion[];
		kind: 'field' | 'value';
		highlight: number;
		onPick: (index: number) => void;
	} = $props();
</script>

<ul
	class="menu border-line bg-base-100 rounded-box absolute top-full right-0 left-0 z-50 mt-1 w-full flex-nowrap border p-1 shadow-lg"
>
	{#each items as item, i (item.insert)}
		<li>
			<button
				type="button"
				class="flex items-center gap-2 px-2 py-1 font-mono text-xs {i === highlight
					? 'menu-active'
					: ''}"
				onmousedown={(e) => {
					e.preventDefault();
					onPick(i);
				}}
			>
				{#if kind === 'field'}
					<Tag class="text-base-content/50 h-3 w-3 shrink-0" />
				{:else}
					<Text class="text-base-content/50 h-3 w-3 shrink-0" />
				{/if}
				<span class="min-w-0 flex-1 truncate text-left">{item.label}</span>
				{#if item.detail !== null}
					<span class="text-base-content/50 shrink-0 text-[10px]">{item.detail}</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>
