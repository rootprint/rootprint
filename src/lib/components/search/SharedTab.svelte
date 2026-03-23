<script lang="ts">
	import { X } from 'lucide-svelte';
	import { deleteSavedQuery } from '$lib/api/saved-queries.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import type { ParsedQuery, SharedQueryEntry } from '$lib/types';
	import DrawerList from './DrawerList.svelte';
	import DrawerRow from './DrawerRow.svelte';

	let {
		entries,
		onrestore,
		currentUserId,
		isAdmin = false
	}: {
		entries: SharedQueryEntry[];
		onrestore: (params: Partial<ParsedQuery>) => void;
		currentUserId: string | undefined;
		isAdmin?: boolean;
	} = $props();

	function restoreShared(entry: SharedQueryEntry) {
		onrestore({ query: entry.query });
	}

	async function removeShared(id: number) {
		try {
			await deleteSavedQuery({ id });
			await invalidateAll();
			toast.success('Shared query deleted');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete query'));
		}
	}
</script>

<DrawerList empty={entries.length === 0} emptyMessage="No shared queries yet">
	{#each entries as entry (entry.id)}
		<DrawerRow onclick={() => restoreShared(entry)}>
			<div class="flex items-center gap-1">
				<span class="flex-1 truncate text-xs font-medium">
					{entry.name}
				</span>
				{#if entry.userId === currentUserId || isAdmin}
					<button
						class="btn p-0 opacity-0 btn-ghost btn-xs group-hover:opacity-100"
						onclick={(e) => {
							e.stopPropagation();
							removeShared(entry.id);
						}}
						title="Delete shared query"
					>
						<X size={16} />
					</button>
				{/if}
			</div>
			<div class="flex items-center gap-1.5 text-[10px] text-base-content/60">
				<span class="truncate">{entry.query || '*'}</span>
				<span class="ml-auto badge shrink-0 badge-ghost badge-xs"
					>{entry.username ?? 'unknown'}</span
				>
			</div>
			{#if entry.description}
				<div class="truncate text-[10px] text-base-content/50 italic">
					{entry.description}
				</div>
			{/if}
		</DrawerRow>
	{/each}
</DrawerList>
