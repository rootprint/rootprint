<script lang="ts">
	import { CodeXml, Check, Copy } from 'lucide-svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { highlightCode } from '$lib/utils/code-highlight';
	import { apiKeyDecorations } from '$lib/send-logs/snippet-utils';
	import type { SnippetLang } from '$lib/send-logs/types';

	let {
		code,
		lang,
		copyTitle = 'Copy',
		highlightValue
	}: {
		code: string;
		lang: SnippetLang;
		copyTitle?: string;
		highlightValue?: string;
	} = $props();

	const langLabel = $derived(lang.charAt(0).toUpperCase() + lang.slice(1));

	let html = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;
		html = null;
		(async () => {
			try {
				const decorations = highlightValue ? apiKeyDecorations(code, highlightValue) : undefined;
				const highlighted = await highlightCode(code, lang, { decorations });
				if (cancelled) return;
				html = highlighted;
			} catch {
				if (!cancelled) html = null;
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<div class="border-line rounded-box overflow-hidden border">
	<div class="border-line bg-base-200 flex items-center justify-between gap-3 border-b px-3 py-1.5">
		<div class="text-base-content/70 flex items-center gap-2 text-sm">
			<CodeXml size={14} class="shrink-0" />
			<span>{langLabel}</span>
		</div>
		<CopyButton text={code} class="btn btn-ghost btn-xs" ariaLabel={copyTitle}>
			{#snippet children({ copied }: { copied: boolean })}
				{#if copied}
					<Check size={14} />
					Copied
				{:else}
					<Copy size={14} />
					Copy
				{/if}
			{/snippet}
		</CopyButton>
	</div>
	<div
		class="overflow-x-auto bg-white text-sm leading-relaxed [&_pre]:px-4 [&_pre]:py-3 [&_pre]:whitespace-pre"
	>
		{#if html}
			<!-- html is Shiki output with substituted API keys wrapped via decorations. -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html html}
		{:else}
			<pre><code>{code}</code></pre>
		{/if}
	</div>
</div>
