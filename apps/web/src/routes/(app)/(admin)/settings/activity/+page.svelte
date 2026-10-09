<script lang="ts">
	import KpiStrip from '#lib/components/settings/activity/KpiStrip.svelte';
	import LatencyChart from '#lib/components/settings/activity/LatencyChart.svelte';
	import TopActorsTable from '#lib/components/settings/activity/TopActorsTable.svelte';
	import TimeRangeTabs from '#lib/components/ui/TimeRangeTabs.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import PanelError from '#lib/components/ui/PanelError.svelte';
	import type { Window } from '#lib/utils/time-range.js';
	import { setSearchParam } from '#lib/components/settings/search-params.js';

	let { data } = $props();

	function setWindow(next: Window) {
		setSearchParam('window', next, { resetOffset: false });
	}
</script>

<div class="settings-page">
	<PageHeader title="Search activity" description="Search latency, volume, and per-actor usage.">
		{#snippet actions()}
			<TimeRangeTabs value={data.window} onChange={setWindow} />
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#await data.summary}
			<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
		{:then s}
			<KpiStrip totalSearches={s.totalSearches} p50={s.p50} p95={s.p95} p99={s.p99} />
		{:catch e}
			<PanelError message="Couldn't load the summary" error={e} />
		{/await}

		{#await data.latency}
			<div class="bg-base-200 rounded-box h-72 animate-pulse"></div>
		{:then buckets}
			<LatencyChart {buckets} window={data.window} />
		{:catch e}
			<PanelError message="Couldn't load latency" error={e} />
		{/await}

		{#await data.topActors then rows}
			<TopActorsTable {rows} window={data.window} />
		{:catch e}
			<PanelError message="Couldn't load top actors" error={e} />
		{/await}
	</div>
</div>
