<script lang="ts">
	import { CodeXml, Check, Copy } from 'lucide-svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { highlight } from '$lib/send-logs/highlight';
	import { TOK_OPEN, TOK_CLOSE, stripTokenSentinels } from '$lib/send-logs/snippet-utils';
	import type { SnippetLang } from '$lib/send-logs/types';

	let {
		code,
		lang,
		copyTitle = 'Copy'
	}: {
		code: string;
		lang: SnippetLang;
		copyTitle?: string;
	} = $props();

	const rawCode = $derived(stripTokenSentinels(code));
	const langLabel = $derived(lang.charAt(0).toUpperCase() + lang.slice(1));

	let html = $state<string | null>(null);

	$effect(() => {
		let cancelled = false;
		html = null;
		(async () => {
			try {
				const highlighted = await highlight(code, lang);
				if (cancelled) return;
				html = highlighted
					.replaceAll(TOK_OPEN, '<span class="token-substituted">')
					.replaceAll(TOK_CLOSE, '</span>');
			} catch {
				if (!cancelled) html = null;
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

<div class="hairline rounded-box overflow-hidden">
	<div class="border-base-content/10 bg-base-200 flex items-center justify-between gap-3 border-b px-3 py-1.5">
		<div class="text-base-content/70 flex items-center gap-2 text-sm">
			<CodeXml size={14} class="shrink-0" />
			<span>{langLabel}</span>
		</div>
		<CopyButton text={rawCode} class="btn btn-ghost btn-xs" ariaLabel={copyTitle}>
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
	<div class="overflow-x-auto bg-white text-sm leading-relaxed [&_pre]:px-4 [&_pre]:py-3 [&_pre]:whitespace-pre">
		{#if html}
			<!-- html is Shiki output with sentinel-wrapped token spans replaced. -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html html}
		{:else}
			<pre><code>{rawCode}</code></pre>
		{/if}
	</div>
</div>
