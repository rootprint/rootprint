<script lang="ts">
	import KpiStrip from '$lib/components/activity/KpiStrip.svelte';
	import LatencyChart from '$lib/components/activity/LatencyChart.svelte';
	import TimeRangeTabs from '$lib/components/activity/TimeRangeTabs.svelte';
	import VolumeChart from '$lib/components/activity/VolumeChart.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import { ACTIVITY_PAGE_SIZE } from '$lib/api/activity';
	import type {
		ActorIndexes,
		ActorSummary,
		LatencyBuckets,
		RecentResult,
		VolumeBuckets
	} from '$lib/api/activity';
	import type { Window } from '$lib/utils/time-range';
	import { formatDurationMs } from '$lib/utils/format';
	import { formatActivityTimestamp } from '$lib/utils/time';
	import PanelError from '$lib/components/ui/PanelError.svelte';

	type Props = {
		window: Window;
		offset: number;
		summary: Promise<ActorSummary>;
		volume: Promise<VolumeBuckets>;
		latency: Promise<LatencyBuckets>;
		indexes?: Promise<ActorIndexes>;
		recent: Promise<RecentResult>;
		onSetParam: (key: string, val: string, opts?: { resetOffset?: boolean }) => void;
	};

	let { window, offset, summary, volume, latency, indexes, recent, onSetParam }: Props = $props();
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<p class="eyebrow">Activity</p>
		<TimeRangeTabs value={window} onChange={(w: Window) => onSetParam('window', w)} />
	</div>

	{#await summary}
		<div class="bg-base-200 rounded-box h-24 animate-pulse"></div>
	{:then s}
		<KpiStrip totalSearches={s.totalSearches} p50={s.p50} p95={s.p95} p99={s.p99} />
	{:catch e}
		<PanelError message="Couldn't load the summary" error={e} />
	{/await}

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		{#await volume then buckets}
			<VolumeChart {buckets} {window} />
		{:catch e}
			<PanelError message="Couldn't load search volume" error={e} />
		{/await}

		{#await latency then buckets}
			<LatencyChart {buckets} {window} />
		{:catch e}
			<PanelError message="Couldn't load latency" error={e} />
		{/await}
	</div>

	{#if indexes}
		{#await indexes then rows}
			<div class="flex flex-col gap-2">
				<p class="eyebrow">Indexes hit</p>
				<ListCard
					cols="minmax(0,1fr) auto auto"
					empty={rows.length === 0}
					emptyMessage="No index activity in this window."
				>
					<div
						class="text-base-content/50 col-span-full grid grid-cols-subgrid items-center px-4 py-2.5 text-[10px] tracking-wide uppercase"
					>
						<span>Index</span>
						<span class="text-right">Searches</span>
						<span class="text-right">Avg duration</span>
					</div>
					{#each rows as r (r.indexId)}
						<div class="col-span-full grid grid-cols-subgrid items-center px-4 py-3.5 text-sm">
							<span class="min-w-0 truncate">{r.indexId}</span>
							<span class="text-right tabular-nums">{r.count.toLocaleString()}</span>
							<span class="text-right whitespace-nowrap tabular-nums">
								{formatDurationMs(r.avgDurationMs)}
							</span>
						</div>
					{/each}
				</ListCard>
			</div>
		{:catch e}
			<PanelError message="Couldn't load index activity" error={e} />
		{/await}
	{/if}

	<div class="flex flex-col gap-2">
		<p class="eyebrow">Recent activity</p>

		{#await recent}
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
							{formatActivityTimestamp(r.executedAt)}
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
					{Math.min(offset + rec.rows.length, rec.total).toLocaleString()} / {rec.total.toLocaleString()}
				</span>
				<div class="flex gap-2">
					<button
						class="btn btn-xs"
						disabled={offset === 0}
						onclick={() => onSetParam('offset', String(Math.max(0, offset - ACTIVITY_PAGE_SIZE)))}
					>
						Prev
					</button>
					<button
						class="btn btn-xs"
						disabled={offset + rec.rows.length >= rec.total}
						onclick={() => onSetParam('offset', String(offset + ACTIVITY_PAGE_SIZE))}
					>
						Next
					</button>
				</div>
			</div>
		{:catch e}
			<PanelError message="Couldn't load recent activity" error={e} />
		{/await}
	</div>
</div>
