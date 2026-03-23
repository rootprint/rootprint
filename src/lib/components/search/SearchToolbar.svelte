<script lang="ts">
	import type { createSearchStore } from '$lib/stores/search.svelte';
	import type { ParsedQuery, TimeRange } from '$lib/types';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import ExportDropdown from '$lib/components/search/ExportDropdown.svelte';
	import QueryInput from '$lib/components/search/QueryInput.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { Clock, Share2, Play } from 'lucide-svelte';
	import { browser } from '$app/environment';

	let {
		store,
		wrapMode = $bindable('none' as 'none' | 'wrap'),
		historyOpen = $bindable(false),
		parsedQuery
	}: {
		store: ReturnType<typeof createSearchStore>;
		wrapMode: 'none' | 'wrap';
		historyOpen: boolean;
		parsedQuery: ParsedQuery;
	} = $props();

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
				<option value={idx.indexId}>{idx.indexId}</option>
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

		<button
			class="btn ml-auto btn-sm {historyOpen ? 'btn-active' : ''}"
			onclick={() => {
				historyOpen = !historyOpen;
			}}
			title="Toggle search history"
		>
			<Clock size={14} />
			History
		</button>

		{#if browser}
			<CopyButton text={window.location.href} class="btn btn-sm">
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
			<span class="text-xs whitespace-nowrap text-base-content/50"
				>{store.numHits.toLocaleString()} hits</span
			>
		{/if}
	</div>
</div>
