<script lang="ts">
	import { KeyRound, Check, Copy } from 'lucide-svelte';
	import CopyButton from './CopyButton.svelte';

	let { value, label }: { value: string; label: string } = $props();
</script>

<div class="border-line rounded-box overflow-hidden border">
	<div class="border-line bg-base-200 flex items-center justify-between gap-3 border-b px-3 py-1.5">
		<div class="text-base-content/70 flex items-center gap-2 text-sm">
			<KeyRound size={14} class="shrink-0" />
			<span>{label}</span>
		</div>
		<CopyButton text={value} class="btn btn-ghost btn-xs" ariaLabel="Copy {label.toLowerCase()}">
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
	<div class="bg-white px-4 py-3 font-mono text-xs leading-relaxed break-all select-all">
		{value}
	</div>
</div>
