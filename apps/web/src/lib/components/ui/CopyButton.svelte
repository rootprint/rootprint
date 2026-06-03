<script lang="ts">
	import type { Snippet } from 'svelte';
	import { copyToClipboard } from '$lib/utils/clipboard';

	let {
		text,
		class: className = 'btn btn-sm btn-neutral',
		ariaLabel,
		children
	}: {
		text: string;
		class?: string;
		ariaLabel?: string;
		children: Snippet<[{ copied: boolean }]>;
	} = $props();

	let copied = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		return () => clearTimeout(resetTimer);
	});

	async function copy() {
		if (await copyToClipboard(text)) {
			copied = true;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copied = false), 1500);
		} else {
			copied = false;
		}
	}
</script>

<button type="button" class={className} aria-label={ariaLabel} onclick={copy}>
	{@render children({ copied })}
</button>
