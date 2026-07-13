<script lang="ts">
	import { Tag, Text } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import type { QuerySuggestion } from '$lib/types';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

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

	let listEl: HTMLUListElement | null = $state(null);

	function preventMouseDown(e: MouseEvent) {
		e.preventDefault();
	}

	function keepInputFocus(node: HTMLElement) {
		node.addEventListener('mousedown', preventMouseDown);
		return {
			destroy: () => node.removeEventListener('mousedown', preventMouseDown)
		};
	}

	$effect(() => {
		if (highlight < 0 || items.length === 0) return;
		listEl?.querySelectorAll('button')[highlight]?.scrollIntoView({ block: 'nearest' });
	});
</script>

<div
	use:keepInputFocus
	class="border-line bg-base-100 rounded-box absolute top-full right-0 left-0 z-50 mt-1 w-full border shadow-lg"
>
	<OverlayScrollbarsComponent options={OS_SCROLLBAR_OPTIONS} defer class="max-h-72">
		<ul bind:this={listEl} class="menu w-full flex-nowrap p-1">
			{#each items as item, i (item.insert)}
				<li>
					<button
						type="button"
						class="flex items-center gap-2 px-2 py-1 font-mono text-xs {i === highlight
							? 'bg-base-content/10'
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
	</OverlayScrollbarsComponent>
</div>
