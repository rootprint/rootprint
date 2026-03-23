<script lang="ts">
	import { Clock, Bookmark, Users } from 'lucide-svelte';
	import { page } from '$app/state';
	import type { ParsedQuery, HistoryEntry, SavedQueryEntry, SharedQueryEntry } from '$lib/types';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import SaveQueryModal from './SaveQueryModal.svelte';
	import HistoryTab from './HistoryTab.svelte';
	import SavedTab from './SavedTab.svelte';
	import SharedTab from './SharedTab.svelte';

	let {
		open = $bindable(false),
		indexId,
		history,
		savedQueries,
		sharedQueries,
		onrestore
	}: {
		open: boolean;
		indexId: string | null;
		history: HistoryEntry[];
		savedQueries: SavedQueryEntry[];
		sharedQueries: SharedQueryEntry[];
		onrestore: (params: Partial<ParsedQuery>) => void;
	} = $props();

	let activeTab = $state<'history' | 'saved' | 'shared'>('history');
	let savingEntry = $state<{ indexName: string; query: string } | null>(null);
	let saveModalOpen = $state(false);

	const tabs = [
		{ id: 'history' as const, label: 'History', icon: Clock },
		{ id: 'saved' as const, label: 'Saved', icon: Bookmark },
		{ id: 'shared' as const, label: 'Shared', icon: Users }
	];

	function handleRestore(params: Partial<ParsedQuery>) {
		onrestore(params);
		open = false;
	}

	$effect(() => {
		if (!saveModalOpen) {
			savingEntry = null;
		}
	});
</script>

<Drawer bind:open {tabs} bind:activeTab panelClass="w-xl">
	<div class="flex-1 overflow-x-hidden overflow-y-auto">
		{#if activeTab === 'history'}
			<HistoryTab
				{indexId}
				entries={history}
				onrestore={handleRestore}
				onbookmark={(entry) => {
					savingEntry = entry;
					saveModalOpen = true;
				}}
			/>
		{:else if activeTab === 'saved'}
			<SavedTab entries={savedQueries} onrestore={handleRestore} />
		{:else if activeTab === 'shared'}
			<SharedTab
				entries={sharedQueries}
				onrestore={handleRestore}
				currentUserId={page.data.user?.id}
				isAdmin={page.data.user?.role === 'admin'}
			/>
		{/if}
	</div>
	<SaveQueryModal
		bind:open={saveModalOpen}
		entry={savingEntry
			? {
					indexId: savingEntry.indexName,
					query: savingEntry.query
				}
			: null}
	/>
</Drawer>
