<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import Breadcrumb from './Breadcrumb.svelte';
	import { resolveBreadcrumbs } from '$lib/settings-nav';

	let {
		title,
		description,
		actions,
		children
	}: {
		title?: string;
		description?: string;
		actions?: Snippet;
		children?: Snippet;
	} = $props();

	const segments = $derived(resolveBreadcrumbs(page.route.id, page.params));
</script>

{#snippet body()}
	{#if children}
		{@render children()}
	{:else if title}
		<h1 class="text-h1 mt-3">{title}</h1>
	{/if}
	{#if description}
		<p class="text-base-content/60 mt-3 text-sm">{description}</p>
	{/if}
{/snippet}

{#if actions}
	<div class="flex items-start justify-between gap-6">
		<div>
			<Breadcrumb {segments} />
			{@render body()}
		</div>
		<div class="mt-1 shrink-0">{@render actions()}</div>
	</div>
{:else}
	<Breadcrumb {segments} />
	{@render body()}
{/if}
