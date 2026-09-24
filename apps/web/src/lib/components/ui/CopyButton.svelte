<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { Check, Copy } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { copyToClipboard } from '$lib/utils/clipboard';

	let {
		text,
		icon: Icon = Copy,
		class: className = 'btn btn-ghost btn-xs',
		disabled,
		children,
		...rest
	}: Omit<HTMLButtonAttributes, 'onclick' | 'children'> & {
		// A resolver that returns undefined has already told the user why there is nothing to copy.
		text: string | (() => Promise<string | undefined>);
		icon?: typeof Copy;
		children?: Snippet;
	} = $props();

	let copied = $state(false);
	let busy = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		return () => clearTimeout(resetTimer);
	});

	async function copy() {
		let value: string | undefined;
		if (typeof text === 'string') value = text;
		else {
			busy = true;
			try {
				value = await text();
			} finally {
				busy = false;
			}
		}
		if (value === undefined) return;
		if (!(await copyToClipboard(value))) {
			toast.error('Failed to copy');
			return;
		}
		copied = true;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copied = false), 1500);
	}
</script>

<button {...rest} type="button" class={className} disabled={disabled || busy} onclick={copy}>
	{#if busy}
		<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
	{:else if copied}
		<Check class="text-success size-3 shrink-0" aria-hidden="true" />
	{:else}
		<Icon class="size-3 shrink-0" aria-hidden="true" />
	{/if}
	{@render children?.()}
	<span class="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
</button>
