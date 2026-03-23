<script lang="ts">
	import { Users, X } from 'lucide-svelte';
	import { deleteSavedQuery, shareQuery, unshareQuery } from '$lib/api/saved-queries.remote';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import type { ParsedQuery, SavedQueryEntry } from '$lib/types';
	import DrawerList from './DrawerList.svelte';
	import DrawerRow from './DrawerRow.svelte';

	let {
		entries,
		onrestore
	}: {
		entries: SavedQueryEntry[];
		onrestore: (params: Partial<ParsedQuery>) => void;
	} = $props();

	function restoreSaved(entry: SavedQueryEntry) {
		onrestore({
			query: entry.query
		});
	}

	async function removeSaved(id: number) {
		await deleteSavedQuery({ id });
		await invalidateAll();
	}

	async function toggleShare(entry: SavedQueryEntry) {
		try {
			if (entry.isShared) {
				await unshareQuery({ id: entry.id });
				toast.success('Query unshared');
			} else {
				await shareQuery({ id: entry.id });
				toast.success('Query shared with team');
			}
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to update sharing'));
		}
	}
</script>

<DrawerList empty={entries.length === 0} emptyMessage="No saved queries yet">
	{#each entries as entry (entry.id)}
		<DrawerRow onclick={() => restoreSaved(entry)}>
			<div class="flex items-center gap-1">
				<span class="flex-1 truncate text-xs font-medium">
					{entry.name}
				</span>
				<button
					class="btn p-0 btn-ghost btn-xs {entry.isShared
						? 'text-info opacity-60'
						: 'opacity-0 group-hover:opacity-60'}"
					onclick={(e) => {
						e.stopPropagation();
						toggleShare(entry);
					}}
					title={entry.isShared ? 'Unshare query' : 'Share with team'}
				>
					<Users size={16} />
				</button>
				<button
					class="btn p-0 opacity-0 btn-ghost btn-xs group-hover:opacity-100"
					onclick={(e) => {
						e.stopPropagation();
						removeSaved(entry.id);
					}}
					title="Remove saved query"
				>
					<X size={16} />
				</button>
			</div>
			<div class="flex items-center gap-1.5 text-[10px] text-base-content/60">
				<span class="truncate">{entry.query || '*'}</span>
			</div>
			{#if entry.description}
				<div class="truncate text-[10px] text-base-content/50 italic">
					{entry.description}
				</div>
			{/if}
		</DrawerRow>
	{/each}
</DrawerList>
