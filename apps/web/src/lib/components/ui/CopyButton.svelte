<script lang="ts">
	import type { Snippet } from 'svelte';

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
		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			clearTimeout(resetTimer);
			resetTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<button type="button" class={className} aria-label={ariaLabel} onclick={copy}>
	{@render children({ copied })}
</button>
