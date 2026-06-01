<script lang="ts">
	import { format, parseISO } from 'date-fns';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import ActivityTable from '$lib/components/activity/ActivityTable.svelte';
	import KpiStrip from '$lib/components/activity/KpiStrip.svelte';
	import LatencyChart from '$lib/components/activity/LatencyChart.svelte';
	import TimeRangeTabs from '$lib/components/activity/TimeRangeTabs.svelte';
	import UserIdentity from '$lib/components/ui/UserIdentity.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import type { Window, SlowestRows, TopActors } from '$lib/api/activity';
	import { formatDurationMs } from '$lib/utils/format';
	import { formatTimestampRange } from '$lib/utils/time';

	let { data } = $props();

	function setWindow(next: Window) {
		const url = new URL(page.url);
		url.searchParams.set('window', next);
		goto(url, { replaceState: false, keepFocus: true, noScroll: true });
	}
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
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
			{void console.error('[activity] summary failed', e)}
		{/await}

		{#await data.latency}
			<div class="bg-base-200 rounded-box h-72 animate-pulse"></div>
		{:then buckets}
			<LatencyChart {buckets} window={data.window} />
		{:catch e}
			{void console.error('[activity] latency failed', e)}
		{/await}

		{#snippet slowestActorCell(r: SlowestRows[number])}
			{#if r.source === 'ui'}
				<UserIdentity
					id={r.actorId}
					name={r.actorLabel}
					size="sm"
					href={`/settings/activity/users/${r.actorId}?window=${data.window}`}
				/>
			{:else}
				<a
					class="link link-hover"
					href={`/settings/activity/api-keys/${r.actorId}?window=${data.window}`}
				>
					{r.actorLabel ?? r.actorId}
				</a>
			{/if}
		{/snippet}

		{#snippet topActorCell(r: TopActors[number])}
			{#if r.kind === 'user'}
				<UserIdentity
					id={r.id}
					name={r.label}
					size="sm"
					href={`/settings/activity/users/${r.id}?window=${data.window}`}
				/>
			{:else}
				<a
					class="link link-hover"
					href={`/settings/activity/api-keys/${r.id}?window=${data.window}`}
				>
					{r.label ?? r.id}
				</a>
			{/if}
		{/snippet}

		{#await data.slowest then rows}
			<ActivityTable
				title="Slowest queries"
				{rows}
				empty="No searches in this window."
				columns={[
					{
						key: 'time',
						label: 'Time',
						render: (r) => format(parseISO(r.executedAt), 'yyyy-MM-dd HH:mm:ss')
					},
					{ key: 'index', label: 'Index', render: (r) => r.indexId },
					{ key: 'actor', label: 'Actor', cell: slowestActorCell },
					{ key: 'duration', label: 'Duration', render: (r) => formatDurationMs(r.durationMs) },
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
		{:catch e}
			{void console.error('[activity] slowest failed', e)}
		{/await}

		{#await data.topActors then rows}
			<ActivityTable
				title="Top actors"
				{rows}
				empty="No actor activity in this window."
				columns={[
					{ key: 'actor', label: 'Actor', cell: topActorCell },
					{ key: 'source', label: 'Source', render: (r) => r.kind },
					{ key: 'indexes', label: 'Indexes', render: (r) => r.indexes.join(', ') },
					{ key: 'count', label: 'Searches', render: (r) => r.count.toLocaleString() },
					{ key: 'avg', label: 'Avg', render: (r) => formatDurationMs(r.avgDurationMs) }
				]}
			/>
		{:catch e}
			{void console.error('[activity] top-actors failed', e)}
		{/await}
	</div>
</div>
