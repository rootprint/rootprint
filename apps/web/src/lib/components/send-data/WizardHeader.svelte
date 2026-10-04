<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import { page } from '$app/state';
	import Breadcrumb from '#lib/components/ui/Breadcrumb.svelte';
	import { resolveBreadcrumbs } from '#lib/admin-nav.js';
	import type { Integration } from '#lib/components/send-data/types.js';

	let { integration }: { integration: Integration } = $props();

	const Icon = $derived(integration.icon);
	const segments = $derived([
		...resolveBreadcrumbs(page.route.id, page.params).slice(0, -1),
		{ label: integration.label }
	]);
</script>

<header class="flex flex-col gap-3">
	<Breadcrumb {segments} />
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-h1 flex min-w-0 items-center gap-3">
			<Icon class="size-9 shrink-0" aria-hidden="true" />
			<span class="break-words">{integration.label}</span>
		</h1>
		<a
			href={integration.docs}
			target="_blank"
			rel="noreferrer"
			class="link link-hover text-muted hover:text-base-content flex shrink-0 items-center gap-1.5 text-xs"
		>
			Documentation
			<ExternalLink class="size-3" aria-hidden="true" />
		</a>
	</div>
</header>
