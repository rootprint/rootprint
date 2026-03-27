<script lang="ts">
	import type { createSearchStore } from '$lib/stores/search.svelte';
	import type { ParsedQuery, TimeRange, DrawerTab } from '$lib/types';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import ExportDropdown from '$lib/components/search/ExportDropdown.svelte';
	import QueryInput from '$lib/components/search/QueryInput.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { Clock, Share2, Play, Bookmark, Users, Save } from 'lucide-svelte';
	import SaveQueryModal from '$lib/components/search/SaveQueryModal.svelte';
	import { browser } from '$app/environment';

	let {
		store,
		wrapMode = $bindable('none' as 'none' | 'wrap'),
		drawerTab = $bindable(null as DrawerTab | null),
		parsedQuery
	}: {
		store: ReturnType<typeof createSearchStore>;
		wrapMode: 'none' | 'wrap';
		drawerTab: DrawerTab | null;
		parsedQuery: ParsedQuery;
	} = $props();

	let saveModalOpen = $state(false);

	const drawerButtons: { id: DrawerTab; icon: typeof Clock; title: string }[] = [
		{ id: 'history', icon: Clock, title: 'History' },
		{ id: 'saved', icon: Bookmark, title: 'Saved queries' },
		{ id: 'shared', icon: Users, title: 'Shared queries' }
	];

	function toggleDrawer(tab: DrawerTab) {
		drawerTab = drawerTab === tab ? null : tab;
	}

	let queryInputRef = $state<ReturnType<typeof QueryInput>>();
</script>

<div class="border-b border-base-300 bg-base-100 px-4 py-3">
	<div class="flex w-full items-center gap-2">
		<select
			class="select-bordered select w-48 select-sm"
			value={store.selectedIndex}
			onchange={(e) => store.handleIndexChange(e.currentTarget.value)}
		>
			{#each store.indexes as idx (idx.indexId)}
				<option value={idx.indexId}>{idx.displayName || idx.indexId}</option>
			{/each}
		</select>

		<div class="join">
			{#each [['none', 'No wrap'], ['wrap', 'Wrap']] as [mode, label] (mode)}
				<button
					class="btn join-item whitespace-nowrap btn-sm {wrapMode === mode ? 'btn-accent' : ''}"
					onclick={() => (wrapMode = mode as typeof wrapMode)}
				>
					{label}
				</button>
			{/each}
		</div>

		<div class="join ml-auto">
			{#each drawerButtons as { id, icon: Icon, title } (id)}
				<button
					class="btn join-item btn-sm {drawerTab === id ? 'btn-active' : ''}"
					onclick={() => toggleDrawer(id)}
					{title}
				>
					<Icon size={14} />
				</button>
			{/each}
		</div>

		<button
			class="btn btn-sm"
			onclick={() => (saveModalOpen = true)}
			disabled={!store.selectedIndex}
			title="Save current query"
		>
			<Save size={14} />
			Save
		</button>

		{#if browser}
			<CopyButton text={() => window.location.href} class="btn btn-sm">
				{#snippet children({ copied })}
					<Share2 size={14} />
					{copied ? 'Copied!' : 'Share'}
				{/snippet}
			</CopyButton>
		{/if}

		<ExportDropdown
			logs={store.logs.map((e) => e.hit)}
			indexId={store.selectedIndex}
			timestampField={store.fieldConfig.timestampField}
			levelField={store.fieldConfig.levelField}
			messageField={store.fieldConfig.messageField}
		/>

		<TimeRangePicker
			value={store.timeRange}
			timezoneMode={store.timezoneMode}
			onchange={(range: TimeRange) => store.navigateQuery({ timeRange: range })}
			ontimezonechange={(mode) => store.navigateQuery({ timezoneMode: mode })}
		/>

		<button
			class="btn btn-sm btn-accent"
			onclick={() => queryInputRef?.submit()}
			disabled={store.loading || !store.selectedIndex}
		>
			<Play size={14} />
			{store.loading && !store.logs.length ? 'Running...' : 'Run query'}
		</button>
	</div>

	<div class="mt-2 flex w-full items-center gap-2">
		<QueryInput
			bind:this={queryInputRef}
			externalValue={parsedQuery.query}
			fields={store.indexFields}
			onsubmit={(query) => store.runQuery(query)}
			onsearchvalues={store.searchFieldValues}
		/>
		{#if store.hasSearched}
			<span class="text-xs font-medium whitespace-nowrap text-base-content/70"
				>{store.numHits.toLocaleString()} hits</span
			>
		{/if}
	</div>

	<SaveQueryModal
		bind:open={saveModalOpen}
		entry={store.selectedIndex
			? { indexId: store.selectedIndex, query: queryInputRef?.getValue() ?? parsedQuery.query }
			: null}
	/>
</div>
