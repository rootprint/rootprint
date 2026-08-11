<script lang="ts">
	import { Copy } from 'lucide-svelte';

	import { copyWithToast } from '$lib/utils/clipboard';
	import { highlightCode } from '$lib/utils/code-highlight';
	import { pluralize } from '$lib/utils/format';
	import { resolveEmbeddedJson } from '$lib/utils/resolve-embedded-json';

	let {
		raw
	}: {
		raw: Record<string, unknown>;
	} = $props();

	const pretty = $derived(JSON.stringify(resolveEmbeddedJson(raw), null, 2));
	const lineCount = $derived(pretty.split('\n').length);

	let html = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;
		html = null;
		highlightCode(pretty, 'json')
			.then((result) => {
				if (!cancelled) html = result;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	function copyAll() {
		void copyWithToast(pretty, 'JSON copied');
	}
</script>

<div class="flex h-full min-h-0 flex-col p-3">
	<div
		class="border-line bg-base-200/50 relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border"
	>
		<div class="border-line bg-base-200 flex items-center justify-between border-b px-3 py-1.5">
			<div class="flex items-center gap-2">
				<span class="eyebrow text-[10px]">JSON</span>
				<span class="text-base-content/40 text-[10px] tabular-nums">
					{pluralize(lineCount, 'line')}
				</span>
			</div>
			<button
				type="button"
				class="btn btn-ghost btn-xs gap-1"
				aria-label="Copy JSON"
				title="Copy JSON"
				onclick={copyAll}
			>
				<Copy class="h-3 w-3" aria-hidden="true" />
				Copy
			</button>
		</div>
		<div class="json-pane min-h-0 flex-1 overflow-auto px-3 py-2 text-xs leading-relaxed">
			{#if html}
				{@html html}
			{:else}
				<pre class="text-base-content/60 font-mono">{pretty}</pre>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Shiki injects its own background on `<pre>`; we want it transparent so
     our code-block container's bg shows through. */
	.json-pane :global(pre.shiki) {
		background-color: transparent !important;
		margin: 0;
		padding: 0;
		font-family: var(--font-mono);
	}
	.json-pane :global(pre.shiki code) {
		font-family: inherit;
	}
</style>
