<script lang="ts">
	import { Bookmark, Clock, Users } from 'lucide-svelte';

	import { page } from '$app/state';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import type {
		DrawerTab,
		HistoryEntry,
		ParsedQuery,
		SavedQueryEntry,
		SharedQueryEntry
	} from '$lib/types';

	import HistoryTab from './HistoryTab.svelte';
	import SavedTab from './SavedTab.svelte';
	import SaveQueryModal from './SaveQueryModal.svelte';
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

	let activeTab = $state<DrawerTab>(drawerTab ?? 'history');
	// Bidirectional sync: $derived can't be used because Drawer's bind:open requires a writable value
	let drawerOpen = $state(drawerTab !== null);

	$effect(() => {
		if (drawerTab !== null) {
			drawerOpen = true;
			activeTab = drawerTab;
		} else {
			drawerOpen = false;
		}
	});

	$effect(() => {
		drawerTab = drawerOpen ? activeTab : null;
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
