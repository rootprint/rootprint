<script lang="ts">
	import KpiStrip from '$lib/components/activity/KpiStrip.svelte';
	import LatencyChart from '$lib/components/activity/LatencyChart.svelte';
	import TimeRangeTabs from '$lib/components/activity/TimeRangeTabs.svelte';
	import VolumeChart from '$lib/components/activity/VolumeChart.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { Window } from '$lib/api/activity';
	import { formatDurationMs } from '$lib/utils/format';
	import { formatActivityTimestamp } from '$lib/utils/time';
	import { setSearchParam } from '$lib/utils/search-params';

	let { data } = $props();
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader>
		{#snippet actions()}
			<TimeRangeTabs value={data.window} onChange={(w: Window) => setSearchParam('window', w)} />
		{/snippet}
		{#await data.summary}
			<h1 class="text-h1 text-base-content/40 mt-3">Loading…</h1>
		{:then s}
			<h1 class="text-h1 mt-3">{s.displayName ?? `API key #${data.apiKeyId}`}</h1>
			<p class="text-base-content/60 mt-2 font-mono text-xs">#{data.apiKeyId}</p>
		{:catch}
			<h1 class="text-h1 mt-3">API key #{data.apiKeyId}</h1>
		{/await}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#await data.summary}
			<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
		{:then s}
			<KpiStrip totalSearches={s.totalSearches} p50={s.p50} p95={s.p95} p99={s.p99} />
		{:catch e}
			{void console.error('[activity] api-key summary failed', e)}
		{/await}

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#await data.volume then buckets}
				<VolumeChart {buckets} window={data.window} />
			{:catch e}
				{void console.error('[activity] api-key volume failed', e)}
			{/await}
			{#await data.latency then buckets}
				<LatencyChart {buckets} window={data.window} />
			{:catch e}
				{void console.error('[activity] api-key latency failed', e)}
			{/await}
		</div>

		<div class="flex flex-col gap-2">
			<p class="eyebrow">Recent activity</p>
			{#await data.recent}
				<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
			{:then rec}
				<ListCard
					cols="auto minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr)"
					gap="gap-x-6"
					empty={rec.rows.length === 0}
					emptyMessage="No activity in this window."
				>
					<div
						class="text-base-content/50 col-span-full grid grid-cols-subgrid items-center px-4 py-2.5 text-[10px] tracking-wide uppercase"
					>
						<span>Time</span>
						<span class="text-center">Index</span>
						<span class="text-right">Duration</span>
						<span class="text-center">Hits</span>
						<span>Query</span>
					</div>
					{#each rec.rows as r (r.id)}
						<div class="col-span-full grid grid-cols-subgrid items-center px-4 py-3.5 text-sm">
							<span class="text-base-content/60 font-mono text-xs whitespace-nowrap">
								{formatActivityTimestamp(r.executedAt, 'local')}
							</span>
							<span class="min-w-0 truncate text-center">{r.indexId}</span>
							<span class="text-right whitespace-nowrap tabular-nums">
								{formatDurationMs(r.durationMs)}
							</span>
							<span class="text-center tabular-nums">
								{r.numHits === null ? '—' : r.numHits.toLocaleString()}
							</span>
							<span class="min-w-0 truncate">
								{r.query.length > 80 ? r.query.slice(0, 80) + '…' : r.query}
							</span>
						</div>
					{/each}
				</ListCard>
				<div class="flex items-center justify-between pt-1 text-xs">
					<span class="text-base-content/60">
						{Math.min(data.offset + rec.rows.length, rec.total).toLocaleString()} / {rec.total.toLocaleString()}
					</span>
					<div class="flex gap-2">
						<button
							class="btn btn-xs"
							disabled={data.offset === 0}
							onclick={() => setSearchParam('offset', String(Math.max(0, data.offset - 50)))}
						>
							Prev
						</button>
						<button
							class="btn btn-xs"
							disabled={data.offset + rec.rows.length >= rec.total}
							onclick={() => setSearchParam('offset', String(data.offset + 50))}
						>
							Next
						</button>
					</div>
				</div>
			{:catch e}
				{void console.error('[activity] api-key recent failed', e)}
			{/await}
		</div>
	</div>
</div>
