<script lang="ts">
	import { CodeXml } from 'lucide-svelte';

	import CopyButton from './CopyButton.svelte';

	let {
		code,
		html,
		lang,
		copyTitle = 'Copy'
	}: {
		code: string;
		html: string;
		lang: string;
		copyTitle?: string;
	} = $props();

	const langLabel = $derived(lang.charAt(0).toUpperCase() + lang.slice(1));
</script>

<div class="overflow-hidden rounded-lg border border-base-300">
	<div
		class="flex items-center justify-between gap-3 border-b border-base-300 bg-base-200 px-3 py-1.5"
	>
		<div class="flex items-center gap-2 text-sm text-base-content/70">
			<CodeXml size={14} class="shrink-0" />
			<span>{langLabel}</span>
		</div>
		<CopyButton text={code} class="btn btn-ghost btn-xs" title={copyTitle} />
	</div>
	<div class="overflow-x-auto bg-white text-sm leading-relaxed [&_pre]:px-4 [&_pre]:py-3">
		<!-- html is produced by Shiki on the server, which escapes the source code -->
		{@html html}
	</div>
</div>
