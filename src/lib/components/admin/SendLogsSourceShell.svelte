<script lang="ts">
	import { BookOpen } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	let {
		title,
		docHref,
		children
	}: {
		title: string;
		docHref?: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-5">
	<div class="flex items-center justify-between gap-4">
		<h2 class="text-xl font-semibold">{title}</h2>
		{#if docHref}
			<a
				href={docHref}
				target="_blank"
				rel="noreferrer"
				class="btn gap-2 btn-sm btn-ghost"
			>
				<BookOpen size={14} />
				Read the docs
			</a>
		{/if}
	</div>

	{@render children()}
</div>
