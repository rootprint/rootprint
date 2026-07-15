<script lang="ts">
	import { ExternalLink, X } from 'lucide-svelte';
	import { page } from '$app/state';
	import type { ContextChip } from '$lib/types';

	let {
		chips,
		indexId,
		disabled = false,
		onRemove,
		onOpenAsSearch
	}: {
		chips: ContextChip[];
		indexId: string;
		disabled?: boolean;
		onRemove: (field: string) => void;
		onOpenAsSearch: () => void;
	} = $props();

	const isAdmin = $derived(
		(page.data.session?.user as { role?: string } | undefined)?.role === 'admin'
	);
</script>

<div class="border-line bg-base-100 flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
	{#if chips.length === 0}
		<span class="text-base-content/40 text-xs italic">
			Context not scoped — showing surrounding logs
		</span>
		{#if isAdmin}
			<a href="/settings/indexes/{indexId}" class="link link-hover text-xs">
				Configure context fields
			</a>
		{/if}
	{:else}
		{#each chips as chip (chip.field)}
			<span class="badge badge-sm badge-neutral badge-soft gap-1 font-mono">
				<span class="max-w-[10rem] truncate" title={chip.field}>{chip.field}</span>
				<span class="opacity-60">=</span>
				<span class="max-w-[14rem] truncate" title={String(chip.value)}>"{String(chip.value)}"</span
				>
				<button
					type="button"
					class="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
					aria-label={`Remove ${chip.field} from context`}
					title="Remove from context"
					{disabled}
					onclick={() => onRemove(chip.field)}
				>
					<X class="h-3 w-3" />
				</button>
			</span>
		{/each}
	{/if}

	<button
		type="button"
		class="btn btn-xs btn-ghost ml-auto"
		title="Open these filters and the surrounding time window in the main search"
		{disabled}
		onclick={onOpenAsSearch}
	>
		<ExternalLink class="h-3 w-3" />
		Open as full search
	</button>
</div>
