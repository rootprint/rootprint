<script lang="ts">
	import CopyButton from '#lib/components/ui/CopyButton.svelte';
	import { highlightCode } from '#lib/utils/code-highlight.js';
	import { pluralize } from '#lib/utils/format.js';
	import { resolveEmbeddedJson } from '#lib/components/logs/resolve-embedded-json.js';

	let {
		raw
	}: {
		raw: Record<string, unknown>;
	} = $props();

	const pretty = $derived(JSON.stringify(resolveEmbeddedJson(raw), null, 2));
	const lineCount = $derived(pretty.split('\n').length);

	const highlighted = $derived(highlightCode(pretty, 'json'));
</script>

<div class="flex h-full min-h-0 flex-col p-3">
	<div
		class="border-line bg-base-200/50 rounded-box relative flex min-h-0 flex-1 flex-col overflow-hidden border"
	>
		<div class="border-line bg-base-200 flex items-center justify-between border-b px-3 py-1.5">
			<div class="flex items-center gap-2">
				<span class="section-label">JSON</span>
				<span class="text-subtle text-xs tabular-nums">
					{pluralize(lineCount, 'line')}
				</span>
			</div>
			<CopyButton
				text={pretty}
				class="btn btn-ghost btn-xs gap-1"
				aria-label="Copy JSON"
				title="Copy JSON"
			>
				Copy
			</CopyButton>
		</div>
		<div class="json-pane min-h-0 flex-1 overflow-auto px-3 py-2 text-xs leading-relaxed">
			{#await highlighted}
				<pre class="text-muted font-mono">{pretty}</pre>
			{:then html}
				{@html html}
			{:catch}
				<pre class="text-muted font-mono">{pretty}</pre>
			{/await}
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
