<script lang="ts">
	import { format, parseISO } from 'date-fns';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import ActivityTable from '$lib/components/activity/ActivityTable.svelte';
	import KpiStrip from '$lib/components/activity/KpiStrip.svelte';
	import LatencyChart from '$lib/components/activity/LatencyChart.svelte';
	import TimeRangeTabs from '$lib/components/activity/TimeRangeTabs.svelte';
	import VolumeChart from '$lib/components/activity/VolumeChart.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { Window } from '$lib/api/activity';
	import { formatDurationMs } from '$lib/utils/format';
	import { formatTimestampRange } from '$lib/utils/time';

	let { data } = $props();

	function setParam(key: string, val: string) {
		const url = new URL(page.url);
		url.searchParams.set(key, val);
		if (key !== 'offset') url.searchParams.set('offset', '0');
		goto(url, { replaceState: false, keepFocus: true, noScroll: true });
	}
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader>
		{#snippet actions()}
			<TimeRangeTabs value={data.window} onChange={(w: Window) => setParam('window', w)} />
		{/snippet}
		{#await data.summary}
			<h1 class="text-h1 text-base-content/40 mt-3">Loading…</h1>
		{:then s}
			<h1 class="text-h1 mt-3">{s.displayName ?? data.userId}</h1>
			{#if s.email && s.displayName !== s.email}
				<p class="text-base-content/60 mt-2 font-mono text-xs">{s.email}</p>
			{/if}
		{:catch}
			<h1 class="text-h1 mt-3">{data.userId}</h1>
		{/await}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		{#await data.summary}
			<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
		{:then s}
			<KpiStrip totalSearches={s.totalSearches} p50={s.p50} p95={s.p95} p99={s.p99} />
		{:catch e}
			{void console.error('[activity] user summary failed', e)}
		{/await}

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			{#await data.volume then buckets}
				<VolumeChart {buckets} window={data.window} />
			{:catch e}
				{void console.error('[activity] user volume failed', e)}
			{/await}

			{#await data.latency then buckets}
				<LatencyChart {buckets} window={data.window} />
			{:catch e}
				{void console.error('[activity] user latency failed', e)}
			{/await}
		</div>

		{#await data.indexes then rows}
			<ActivityTable
				title="Indexes hit"
				{rows}
				empty="No index activity in this window."
				columns={[
					{ key: 'index', label: 'Index', render: (r) => r.indexId },
					{ key: 'count', label: 'Searches', render: (r) => r.count.toLocaleString() },
					{ key: 'avg', label: 'Avg duration', render: (r) => formatDurationMs(r.avgDurationMs) }
				]}
			/>
		{:catch e}
			{void console.error('[activity] user indexes failed', e)}
		{/await}

		<div class="border-line rounded-box border p-4">
			<header class="pb-3">
				<p class="eyebrow">Recent activity</p>
			</header>

			{#await data.recent}
				<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
			{:then rec}
				<ActivityTable
					title=""
					rows={rec.rows}
					empty="No activity in this window."
					columns={[
						{
							key: 'time',
							label: 'Time',
							render: (r) => format(parseISO(r.executedAt), 'yyyy-MM-dd HH:mm:ss')
						},
						{ key: 'index', label: 'Index', render: (r) => r.indexId },
						{
							key: 'duration',
							label: 'Duration',
							render: (r) => formatDurationMs(r.durationMs)
						},
						{
							key: 'hits',
							label: 'Hits',
							render: (r) => (r.numHits === null ? '—' : r.numHits.toLocaleString())
						},
						{
							key: 'range',
							label: 'Range',
							class: 'whitespace-nowrap',
							render: (r) => formatTimestampRange(r.startTs, r.endTs)
						},
						{
							key: 'query',
							label: 'Query',
							class: 'max-w-md truncate',
							render: (r) => (r.query.length > 80 ? r.query.slice(0, 80) + '…' : r.query)
						}
					]}
				/>
				<div class="flex items-center justify-between pt-3 text-xs">
					<span class="text-base-content/60">
						{Math.min(data.offset + rec.rows.length, rec.total).toLocaleString()} / {rec.total.toLocaleString()}
					</span>
					<div class="flex gap-2">
						<button
							class="btn btn-xs"
							disabled={data.offset === 0}
							onclick={() => setParam('offset', String(Math.max(0, data.offset - 50)))}
						>
							Prev
						</button>
						<button
							class="btn btn-xs"
							disabled={data.offset + rec.rows.length >= rec.total}
							onclick={() => setParam('offset', String(data.offset + 50))}
						>
							Next
						</button>
					</div>
				</div>
			{:catch e}
				{void console.error('[activity] user recent failed', e)}
			{/await}
		</div>
	</div>
</div>
