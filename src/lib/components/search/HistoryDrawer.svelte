<script lang="ts">
	import { Clock, Bookmark, Users } from 'lucide-svelte';
	import { page } from '$app/state';
	import type { ParsedQuery, HistoryEntry, SavedQueryEntry, SharedQueryEntry, DrawerTab } from '$lib/types';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import SaveQueryModal from './SaveQueryModal.svelte';
	import HistoryTab from './HistoryTab.svelte';
	import SavedTab from './SavedTab.svelte';
	import SharedTab from './SharedTab.svelte';

	let {
		drawerTab = $bindable(null as DrawerTab | null),
		indexId,
		history,
		savedQueries,
		sharedQueries,
		onrestore
	}: {
		drawerTab: DrawerTab | null;
		indexId: string | null;
		history: HistoryEntry[];
		savedQueries: SavedQueryEntry[];
		sharedQueries: SharedQueryEntry[];
		onrestore: (params: Partial<ParsedQuery>) => void;
	} = $props();

	let activeTab = $state<'history' | 'saved' | 'shared'>(drawerTab ?? 'history');
	// Bidirectional sync: $derived can't be used because Drawer's bind:open requires a writable value
	let drawerOpen = $state(drawerTab !== null);

	// drawerTab → open + activeTab
	$effect(() => {
		drawerOpen = drawerTab !== null;
		if (drawerTab) activeTab = drawerTab;
	});

	// activeTab changed inside drawer → sync back to drawerTab
	$effect(() => {
		if (drawerOpen) drawerTab = activeTab;
	});

	// drawer closed → drawerTab = null
	$effect(() => {
		if (!drawerOpen) drawerTab = null;
	});

	let savingEntry = $state<{ indexName: string; query: string } | null>(null);
	let saveModalOpen = $state(false);

	const tabs = [
		{ id: 'history' as const, label: 'History', icon: Clock },
		{ id: 'saved' as const, label: 'Saved', icon: Bookmark },
		{ id: 'shared' as const, label: 'Shared', icon: Users }
	];

	function handleRestore(params: Partial<ParsedQuery>) {
		onrestore(params);
		drawerTab = null;
	}

	$effect(() => {
		if (!saveModalOpen) {
			savingEntry = null;
		}
	});
</script>

<Drawer bind:open={drawerOpen} {tabs} bind:activeTab panelClass="w-xl">
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
