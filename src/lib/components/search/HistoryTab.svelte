<script lang="ts">
	import { Bookmark, X } from 'lucide-svelte';

	import { invalidateAll } from '$app/navigation';
	import { clearHistory, deleteHistoryEntry } from '$lib/api/history.remote';
	import type { HistoryEntry, ParsedQuery } from '$lib/types';
	import { formatTimeRangeLabel } from '$lib/utils/time';
	import { formatRelativeTime } from '$lib/utils/time';

	import DrawerList from './DrawerList.svelte';
	import DrawerRow from './DrawerRow.svelte';

	let {
		indexId,
		entries,
		onrestore,
		onbookmark
	}: {
		indexId: string | null;
		entries: HistoryEntry[];
		onrestore: (params: Partial<ParsedQuery>) => void;
		onbookmark: (entry: { indexName: string; query: string }) => void;
	} = $props();

	function restoreHistory(entry: HistoryEntry) {
		onrestore({
			query: entry.query,
			timeRange: entry.timeRange
		});
	}

	async function remove(id: number) {
		await deleteHistoryEntry({ id });
		await invalidateAll();
	}

	async function clearAll() {
		if (!indexId) return;
		await clearHistory({ indexId });
		await invalidateAll();
	}
</script>

<DrawerList empty={entries.length === 0} emptyMessage="No search history yet">
	{#each entries as entry (entry.id)}
		<DrawerRow onclick={() => restoreHistory(entry)}>
			<div class="flex items-center gap-1">
				<span class="flex-1 truncate text-xs font-medium">
					{entry.query || '*'}
				</span>
				<button
					class="btn p-0 opacity-20 btn-ghost btn-xs group-hover:opacity-60"
					onclick={(e) => {
						e.stopPropagation();
						onbookmark(entry);
					}}
					title="Save query"
				>
					<Bookmark size={16} class="hover:text-warning" />
				</button>
				<button
					class="btn p-0 opacity-0 btn-ghost btn-xs group-hover:opacity-100"
					onclick={(e) => {
						e.stopPropagation();
						remove(entry.id);
					}}
					title="Remove from history"
				>
					<X size={16} />
				</button>
			</div>
			<div class="flex items-center gap-1.5 text-[10px] text-base-content/60">
				<span class="truncate">{formatTimeRangeLabel(entry.timeRange, 'local')}</span>
				<span class="ml-auto shrink-0">{formatRelativeTime(entry.executedAt)}</span>
			</div>
		</DrawerRow>
	{/each}
	<div class="px-3 py-2">
		<button class="btn w-full btn-ghost btn-xs" onclick={clearAll}> Clear all </button>
	</div>
</DrawerList>
