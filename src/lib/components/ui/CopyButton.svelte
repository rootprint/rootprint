<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { Snippet } from 'svelte';

	let {
		text,
		class: className = '',
		title,
		children,
		...rest
	}: {
		text: string;
		class?: string;
		title?: string;
		children?: Snippet<[{ copied: boolean }]>;
		[key: string]: unknown;
	} = $props();

	let copied = $state(false);

	async function handleCopy() {
		try {
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
			} else {
				const textarea = document.createElement('textarea');
				textarea.value = text;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
			}
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}
</script>

<button type="button" class={className} {title} onclick={handleCopy} {...rest}>
	{#if children}
		{@render children({ copied })}
	{:else if copied}
		<Check size={14} />
	{:else}
		<Copy size={14} />
	{/if}
</button>
