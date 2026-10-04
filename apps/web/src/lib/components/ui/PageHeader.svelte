<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import Breadcrumb from './Breadcrumb.svelte';
	import { resolveBreadcrumbs } from '#lib/admin-nav.js';

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

<div class="flex flex-wrap items-start justify-between gap-4">
	<div class="min-w-0 grow">
		<Breadcrumb {segments} />
		{#if children}
			{@render children()}
		{:else if title}
			<h1 class="text-h1 mt-3 break-words">{title}</h1>
		{/if}
		{#if description}
			<p class="text-muted mt-3 text-sm">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="mt-1 shrink-0">{@render actions()}</div>
	{/if}
</div>
