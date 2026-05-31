<script lang="ts">
	import type { BreadcrumbSegment } from '$lib/types';

	let { segments }: { segments: BreadcrumbSegment[] } = $props();
</script>

<p class="eyebrow">
	{#each segments as segment, i (i)}
		{#if i > 0}<span class="text-base-content/30 mx-1.5">/</span>{/if}
		{#if segment.href}
			<a
				class="hover:text-base-content"
				class:font-mono={segment.mono}
				class:normal-case={segment.mono}
				href={segment.href}>{segment.label}</a
			>
		{:else}
			<span class:font-mono={segment.mono} class:normal-case={segment.mono}>{segment.label}</span>
		{/if}
	{/each}
</p>
