<script lang="ts">
	import type { IndexDetail } from 'api/types';
	import { onMount } from 'svelte';

	import { goto } from '$app/navigation';
	import type { LatencyBuckets, Summary, TopActors, VolumeBuckets } from '#lib/api/activity.js';
	import type { ApiKeyView } from '#lib/api/api-keys.js';
	import {
		getIndexDescribe,
		getIndexStats,
		type IndexDescribe,
		type IndexStatsResponse
	} from '#lib/api/indexes.js';
	import LogFrequencyChart from '#lib/components/logs/LogFrequencyChart.svelte';
	import ActivityPanel from '#lib/components/settings/activity/ActivityPanel.svelte';
	import StorageTrendChart from '#lib/components/settings/overview/StorageTrendChart.svelte';
	import { setSearchParam } from '#lib/components/settings/search-params.js';
	import ListCard from '#lib/components/ui/ListCard.svelte';
	import PanelError from '#lib/components/ui/PanelError.svelte';
	import type { HistogramResult } from '#lib/types.js';
	import { formatBytes, formatCount, formatOrDash } from '#lib/utils/format.js';
	import { serialize } from '#lib/utils/query-params.js';
	import { formatAge, formatDate, formatRelativeTime } from '#lib/utils/time.js';
	import { windowToSpanMs, type Window } from '#lib/utils/time-range.js';

	type Props = {
		detail: IndexDetail;
		describe: Promise<IndexDescribe>;
		histogram: Promise<HistogramResult> | null;
		ingestKeys: Promise<ApiKeyView[]>;
		window: Window;
		activity: {
			summary: Promise<Summary>;
			volume: Promise<VolumeBuckets>;
			latency: Promise<LatencyBuckets>;
			actors: Promise<TopActors>;
		};
	};

	let { detail, describe, histogram, ingestKeys, window, activity }: Props = $props();

	const LIVE_WINDOW_S = 5 * 60;
	const STATS_POLL_MS = 30_000;
	let volumeCollapsed = $state(false);

	// Re-described while open so the counts and live dot follow ingestion. A plain value skips the
	// await block's pending branch, so a refresh doesn't flash the skeleton.
	let stats: Promise<IndexDescribe> | IndexDescribe = $derived(describe);

	// Component state, not a URL param, so a range change doesn't re-run the page loader. The chart
	// stays mounted while a range loads and shows its own spinner.
	let growthRange = $state<Window>('7d');
	let growthPoints = $state<IndexStatsResponse['points']>([]);
	let growthLoading = $state(true);
	let growthError = $state<unknown>(null);
	let growthSeq = 0;

	async function loadGrowth() {
		const seq = ++growthSeq;
		growthLoading = true;
		const endTs = Math.floor(Date.now() / 1000);
		const startTs = endTs - windowToSpanMs(growthRange) / 1000;
		try {
			const { points } = await getIndexStats(detail.indexId, { startTs, endTs });
			if (seq !== growthSeq) return;
			growthPoints = points;
			growthError = null;
		} catch (e) {
			if (seq !== growthSeq) return;
			growthError = e;
		}
		growthLoading = false;
	}

	// The page keys this component on the index id, so mount-time is per index.
	onMount(() => {
		void loadGrowth();
		const timer = setInterval(() => {
			// ponytail: a failed refresh keeps the last stats; the next tick tries again
			getIndexDescribe(detail.indexId).then(
				(d) => (stats = d),
				() => {}
			);
		}, STATS_POLL_MS);
		return () => clearInterval(timer);
	});

	type StatCell = { label: string; value: string; live?: boolean };

	function statCells(d: IndexDescribe): StatCell[] {
		const last = d.maxTimestamp;
		// Seconds since the newest event; negative when a client clock runs ahead.
		const age = last === null ? null : Date.now() / 1000 - last;
		const ratio = d.sizeBytes ? d.uncompressedBytes / d.sizeBytes : 0;
		return [
			{ label: 'Docs', value: formatCount(d.numDocs) },
			{ label: 'Index size', value: formatBytes(d.sizeBytes) },
			{ label: 'Uncompressed', value: formatBytes(d.uncompressedBytes) },
			{
				label: 'Compression',
				// Below 1× the splits' fixed index overhead outweighs the docs, so the ratio means nothing.
				value: ratio >= 1 ? `${ratio.toFixed(1)}×` : '—'
			},
			{ label: 'Splits', value: formatCount(d.numSplits) },
			{
				label: 'Last event',
				value: formatOrDash(last, (t) => formatAge(new Date(t * 1000))),
				live: age === null ? undefined : Math.abs(age) < LIVE_WINDOW_S
			}
		];
	}

	function openLogs(start: number, end: number) {
		const params = serialize({
			index: detail.indexId,
			query: '',
			timeRange: { type: 'absolute', start, end },
			sortDirection: 'desc',
			filters: []
		});
		void goto(`/logs?${params}`);
	}
</script>

<div class="flex flex-col gap-6">
	{#await stats}
		<div class="skeleton rounded-box h-[4.5rem]"></div>
	{:then d}
		<dl class="border-line rounded-box grid grid-cols-6 overflow-hidden border">
			{#each statCells(d) as cell, i (cell.label)}
				<div class={['flex flex-col gap-1 px-4 py-3', i > 0 && 'border-line border-l']}>
					<dt class="section-label">{cell.label}</dt>
					<dd class="flex items-center gap-2 text-xl whitespace-nowrap tabular-nums">
						{#if cell.live !== undefined}
							<span
								class={['status', cell.live && 'status-success']}
								title={cell.live ? 'Receiving data' : undefined}
								aria-hidden="true"
							></span>
						{/if}
						{cell.value}
					</dd>
				</div>
			{/each}
		</dl>
	{:catch e}
		<PanelError message="Couldn't load index stats" error={e} />
	{/await}

	{#if histogram}
		<section class="border-line rounded-box border">
			{#await histogram}
				<LogFrequencyChart
					label="Events, last 24 hours"
					buckets={[]}
					loading
					error={null}
					emptyHint="Nothing was indexed in the last 24 hours"
					bind:collapsed={volumeCollapsed}
					onBrush={openLogs}
				/>
			{:then h}
				<LogFrequencyChart
					label="Events, last 24 hours"
					buckets={h.buckets}
					loading={false}
					error={null}
					emptyHint="Nothing was indexed in the last 24 hours"
					bind:collapsed={volumeCollapsed}
					onBrush={openLogs}
				/>
			{:catch e}
				<PanelError message="Couldn't load event volume" error={e} />
			{/await}
		</section>
	{/if}

	{#if growthError}
		<PanelError message="Couldn't load size history" error={growthError} retry={loadGrowth} />
	{:else}
		<StorageTrendChart
			title="Index size"
			indexes={[{ indexId: detail.indexId, displayName: detail.displayName, sizeBytes: null }]}
			histories={{ [detail.indexId]: growthPoints }}
			range={growthRange}
			onRangeChange={(r) => {
				growthRange = r;
				void loadGrowth();
			}}
			loading={growthLoading}
		/>
	{/if}

	<section class="flex flex-col gap-2">
		<p class="section-label">Ingest keys</p>
		{#await ingestKeys}
			<div class="skeleton rounded-box h-24"></div>
		{:then keys}
			<ListCard
				cols="minmax(0,1fr) auto auto auto"
				empty={keys.length === 0}
				emptyMessage="No ingest keys write to this index."
			>
				<div
					class="section-label col-span-full grid grid-cols-subgrid items-center gap-x-6 px-4 py-2.5"
				>
					<span>Name</span>
					<span>Key</span>
					<span class="text-right">Created</span>
					<span class="text-right">Last used</span>
				</div>
				{#each keys as k (k.id)}
					<a
						href="/settings/api-keys"
						class="hover:bg-base-200/40 col-span-full grid grid-cols-subgrid items-center gap-x-6 px-4 py-3 text-sm"
					>
						<span class="min-w-0 truncate">{k.name}</span>
						<span class="text-muted font-mono text-xs">{k.tokenPrefix}...</span>
						<span class="text-right whitespace-nowrap">{formatDate(k.createdAt)}</span>
						<span class="text-right whitespace-nowrap">
							{formatOrDash(k.lastUsedAt, formatRelativeTime)}
						</span>
					</a>
				{/each}
			</ListCard>
		{:catch e}
			<PanelError message="Couldn't load ingest keys" error={e} />
		{/await}
	</section>

	<ActivityPanel
		{window}
		summary={activity.summary}
		volume={activity.volume}
		latency={activity.latency}
		actors={activity.actors}
		onSetParam={setSearchParam}
	/>
</div>
