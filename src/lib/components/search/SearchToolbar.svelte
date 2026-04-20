<script lang="ts">
	import {
		Bookmark,
		ChevronDown,
		Clock,
		Pause,
		Play,
		Save,
		Share2,
		TextWrap,
		Users
	} from 'lucide-svelte';

	import { browser } from '$app/environment';
	import ColumnSettings from '$lib/components/search/ColumnSettings.svelte';
	import ExportDialog from '$lib/components/search/ExportDialog.svelte';
	import QueryInput from '$lib/components/search/QueryInput.svelte';
	import SaveQueryModal from '$lib/components/search/SaveQueryModal.svelte';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { AUTO_REFRESH_INTERVALS } from '$lib/constants/defaults';
	import { storageKeys } from '$lib/constants/storage-keys';
	import type { createSearchStore } from '$lib/stores/search.svelte';
	import type { DrawerTab, ParsedQuery, TimeRange } from '$lib/types';

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
	let autoRefreshOpen = $state(false);
	let autocomplete = $state(
		browser ? localStorage.getItem(storageKeys.autocomplete) !== 'false' : true
	);

	$effect(() => {
		if (browser) localStorage.setItem(storageKeys.autocomplete, String(autocomplete));
	});

	const activeIntervalLabel = $derived(
		AUTO_REFRESH_INTERVALS.find((i) => i.ms === store.autoRefreshInterval)?.label ?? null
	);
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

		<ExportDialog
			numHits={store.numHits}
			query={store.queryText}
			startTimestamp={store.absoluteTimeRange.start}
			endTimestamp={store.absoluteTimeRange.end}
			indexId={store.selectedIndex}
		/>

		<TimeRangePicker
			value={store.timeRange}
			timezoneMode={store.timezoneMode}
			onchange={(range: TimeRange) => store.navigateQuery({ timeRange: range })}
			ontimezonechange={(mode) => store.navigateQuery({ timezoneMode: mode })}
		/>

		{#if autoRefreshOpen}
			<div role="none" class="fixed inset-0 z-10" onclick={() => (autoRefreshOpen = false)}></div>
		{/if}
		<div class="dropdown dropdown-end" class:dropdown-open={autoRefreshOpen}>
			<div class="join">
				{#if store.autoRefreshInterval !== null}
					<button
						class="btn join-item btn-sm btn-accent"
						onclick={() => store.setAutoRefresh(null)}
						title="Stop auto-refresh"
					>
						<Pause size={14} />
						{activeIntervalLabel}
					</button>
				{:else}
					<button
						class="btn join-item btn-sm btn-accent"
						onclick={() => queryInputRef?.submit()}
						disabled={store.loading || !store.selectedIndex}
					>
						<Play size={14} />
						{store.loading && !store.logs.length ? 'Running...' : 'Run query'}
					</button>
				{/if}
				<button
					class="btn join-item border-l border-l-base-content/25 btn-sm btn-accent"
					onclick={() => (autoRefreshOpen = !autoRefreshOpen)}
					disabled={!store.canAutoRefresh}
					title={store.canAutoRefresh
						? 'Auto-refresh interval'
						: 'Auto-refresh requires a relative time range'}
				>
					<ChevronDown size={14} />
				</button>
			</div>
			{#if autoRefreshOpen}
				<div class="dropdown-content menu z-20 mt-1 w-36 rounded-box bg-base-200 p-2 shadow-lg">
					{#if store.autoRefreshInterval !== null}
						<button
							class="btn justify-start btn-ghost btn-sm"
							onclick={() => {
								store.setAutoRefresh(null);
								autoRefreshOpen = false;
							}}
						>
							<Pause size={14} />
							Off
						</button>
						<div class="divider my-0"></div>
					{/if}
					<div
						class="mb-1 px-1 text-xs font-semibold tracking-wider text-base-content/50 uppercase"
					>
						Auto refresh
					</div>
					{#each AUTO_REFRESH_INTERVALS as { label, ms } (ms)}
						<button
							class="btn justify-start btn-ghost btn-sm {store.autoRefreshInterval === ms
								? 'btn-active'
								: ''}"
							onclick={() => {
								store.setAutoRefresh(ms);
								autoRefreshOpen = false;
							}}
						>
							{label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="mt-2 flex w-full items-start gap-2">
		<button
			class="btn btn-sm {autocomplete ? 'btn-accent' : ''}"
			title="Toggle autocomplete"
			aria-pressed={autocomplete}
			onclick={() => (autocomplete = !autocomplete)}
		>
			A
		</button>
		<QueryInput
			bind:this={queryInputRef}
			externalValue={parsedQuery.query}
			fields={store.indexFields}
			{autocomplete}
			onsubmit={(query) => store.runQuery(query)}
			onsearchvalues={async (field, term) => {
				const result = await store.searchFieldValues(field, term);
				return result.values.map((b) => b.value);
			}}
		/>
		<ColumnSettings
			bind:activeFields={store.activeFields}
			allFields={store.indexFields}
			pinnedFields={[store.fieldConfig.levelField, store.fieldConfig.timestampField]}
			pinnedFieldsEnd={[store.fieldConfig.messageField]}
			onchange={store.handleFieldsChange}
		/>
		<button
			class="btn btn-square btn-sm {wrapMode === 'wrap' ? 'btn-accent' : ''}"
			type="button"
			aria-pressed={wrapMode === 'wrap'}
			aria-label="Toggle line wrapping"
			title="Toggle line wrapping"
			onclick={() => {
				wrapMode = wrapMode === 'wrap' ? 'none' : 'wrap';
			}}
		>
			<TextWrap size={14} />
		</button>
	</div>

	<SaveQueryModal
		bind:open={saveModalOpen}
		entry={store.selectedIndex
			? { indexId: store.selectedIndex, query: queryInputRef?.getValue() ?? parsedQuery.query }
			: null}
	/>
</div>
