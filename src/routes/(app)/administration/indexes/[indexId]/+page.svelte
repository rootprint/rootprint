<script lang="ts">
	import { Trash2 } from 'lucide-svelte';

	import { page } from '$app/state';
	import DeleteIndexModal from '$lib/components/admin/DeleteIndexModal.svelte';
	import IndexConfigTab from '$lib/components/index/IndexConfigTab.svelte';
	import IndexFieldsTab from '$lib/components/index/IndexFieldsTab.svelte';
	import IndexOverviewTab from '$lib/components/index/IndexOverviewTab.svelte';
	import IndexSourcesTab from '$lib/components/index/IndexSourcesTab.svelte';
	import IndexStatsRow from '$lib/components/index/IndexStatsRow.svelte';
	import IndexTabs, { type IndexDetailTab } from '$lib/components/index/IndexTabs.svelte';
	import { formatEpochLocale } from '$lib/utils/time';

	let { data } = $props();

	let deleteOpen = $state(false);

	const activeTab: IndexDetailTab = $derived.by(() => {
		const tab = page.url.searchParams.get('tab');
		if (tab === 'fields' || tab === 'sources' || tab === 'configuration') return tab;
		return 'overview';
	});
</script>

<div class="flex flex-col gap-6">
	<header class="flex items-start justify-between gap-4">
		<div>
			<h1 class="font-mono text-2xl font-semibold break-all">{data.detail.indexId}</h1>
			<p class="mt-1 text-sm text-base-content/60">
				{data.detail.mode} schema · Created {formatEpochLocale(data.detail.createTimestamp)} · {data
					.detail.sources.length} sources
			</p>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			<button type="button" class="btn btn-error btn-sm" onclick={() => (deleteOpen = true)}>
				<Trash2 size={14} />
				Delete
			</button>
		</div>
	</header>

	<IndexStatsRow stats={data.stats} />

	<IndexTabs
		{activeTab}
		fieldCount={data.detail.fields.length}
		sourceCount={data.detail.sources.length}
	/>

	{#if activeTab === 'overview'}
		<IndexOverviewTab detail={data.detail} />
	{:else if activeTab === 'fields'}
		<IndexFieldsTab fields={data.detail.fields} />
	{:else if activeTab === 'sources'}
		<IndexSourcesTab sources={data.detail.sources} />
	{:else if activeTab === 'configuration'}
		<IndexConfigTab detail={data.detail} />
	{/if}
</div>

<DeleteIndexModal bind:open={deleteOpen} indexId={data.detail.indexId} />
