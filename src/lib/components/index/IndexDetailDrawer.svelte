<script lang="ts">
	import { Info, ListTree, Plug, Settings } from 'lucide-svelte';

	import IndexConfigTab from '$lib/components/index/IndexConfigTab.svelte';
	import IndexDetailsTab from '$lib/components/index/IndexDetailsTab.svelte';
	import IndexFieldsTab from '$lib/components/index/IndexFieldsTab.svelte';
	import IndexSourcesTab from '$lib/components/index/IndexSourcesTab.svelte';
	import Drawer from '$lib/components/ui/Drawer.svelte';

	import type { PageData } from '../../../routes/(app)/administration/$types';

	type IndexDetail = PageData['indexDetails'][number];

	let {
		open = $bindable(false),
		detail
	}: {
		open: boolean;
		detail: IndexDetail | null;
	} = $props();

	const tabs = [
		{ id: 'details', label: 'Details', icon: Info },
		{ id: 'fields', label: 'Fields', icon: ListTree },
		{ id: 'sources', label: 'Sources', icon: Plug },
		{ id: 'config', label: 'Config', icon: Settings }
	] as const;

	type TabId = (typeof tabs)[number]['id'];

	let activeTab = $state<TabId>('details');
	let fieldFilter = $state('');

	$effect(() => {
		if (detail) {
			activeTab = 'details';
			fieldFilter = '';
		}
	});

	const filteredFields = $derived(
		detail?.fields.filter((f) => f.name.toLowerCase().includes(fieldFilter.toLowerCase())) ?? []
	);
</script>

<Drawer bind:open tabs={[...tabs]} bind:activeTab>
	{#if !detail}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-sm text-base-content/50">Index not found</p>
		</div>
	{:else}
		{#if activeTab === 'fields'}
			<div class="flex items-center gap-2 border-b border-base-300 px-4 py-2">
				<input
					class="input-bordered input input-sm flex-1"
					placeholder="Filter fields..."
					bind:value={fieldFilter}
				/>
				<span class="text-xs text-base-content/50">
					{filteredFields.length} field{filteredFields.length === 1 ? '' : 's'}
				</span>
			</div>
		{/if}

		<div class="flex-1 overflow-x-auto overflow-y-auto p-4">
			{#if activeTab === 'details'}
				<IndexDetailsTab {detail} />
			{:else if activeTab === 'fields'}
				<IndexFieldsTab fields={filteredFields} />
			{:else if activeTab === 'sources'}
				<IndexSourcesTab sources={detail.sources} />
			{:else if activeTab === 'config'}
				<IndexConfigTab {detail} />
			{/if}
		</div>
	{/if}
</Drawer>
