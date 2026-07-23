<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { getClusterOverview, getAdminMetricsRaw, type ClusterOverview } from '$lib/api/admin';
	import { windowToSpanMs, type Window } from '$lib/utils/time-range';
	import { getIndexStats } from '$lib/api/indexes';
	import ClusterIdentityStrip from '$lib/components/admin/overview/ClusterIdentityStrip.svelte';
	import HeadlineNumbers from '$lib/components/admin/overview/HeadlineNumbers.svelte';
	import StorageTrendChart from '$lib/components/admin/overview/StorageTrendChart.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import type { ConnectionState } from '$lib/types';
	import { MetricsPoller } from './metrics-poller.svelte';

	type StatsPoint = Awaited<ReturnType<typeof getIndexStats>>['points'][number];

	let { data } = $props();

	let range = $state<Window>('7d');

	let cluster = $state<ClusterOverview | null>(data.cluster);
	let clusterError = $state<string | null>(data.clusterError);
	let histories = $state<Record<string, StatsPoint[]>>({});
	let historyErrors = $state<Record<string, string>>({});
	let historiesLoading = $state(false);
	let historiesToken = 0;

	const poller = new MetricsPoller();

	let rawFilter = $state('');
	let rawText = $state<string | null>(null);
	let rawLoading = $state(false);
	let rawError = $state<string | null>(null);

	async function loadCluster(): Promise<void> {
		clusterError = null;
		try {
			cluster = await getClusterOverview();
		} catch (err) {
			clusterError = err instanceof Error ? err.message : String(err);
		}
	}

	async function loadHistories(): Promise<void> {
		if (!cluster) return;
		const token = ++historiesToken;
		historiesLoading = true;
		const newErrors: Record<string, string> = {};
		const span = windowToSpanMs(range);
		const to = Date.now();
		const from = to - span;
		const next: Record<string, StatsPoint[]> = {};
		await Promise.all(
			cluster.perIndex.map(async (i) => {
				try {
					const body = await getIndexStats(i.indexId, { from, to, limit: 10000 });
					next[i.indexId] = body.points;
				} catch (err) {
					newErrors[i.indexId] = err instanceof Error ? err.message : String(err);
				}
			})
		);
		// Discard stale waves so a slow earlier fetch can't overwrite fresher data.
		if (token !== historiesToken) return;
		histories = next;
		historyErrors = newErrors;
		historiesLoading = false;
	}

	async function refresh(): Promise<void> {
		await loadCluster();
		await loadHistories();
	}

	function onRangeChange(next: Window): void {
		range = next;
		void loadHistories();
	}

	onMount(() => {
		void loadHistories();
		poller.start();
	});

	onDestroy(() => {
		poller.stop();
	});

	const connectionState = $derived.by<ConnectionState>(() => {
		// Disconnected wins: explicit cluster-fetch error, or the poller has hit its
		// consecutive-failure threshold. A single transient poll miss stays "connected" —
		// the separate stale banner covers that in-between.
		if (clusterError !== null || poller.unavailable) return 'disconnected';
		// Before the first cluster response lands, or during a retry, endpoint/version are unknown.
		if (cluster === null) return 'connecting';
		return 'connected';
	});

	function filteredRaw(text: string, query: string): string {
		if (!query) return text;
		const q = query.toLowerCase();
		return text
			.split('\n')
			.filter((line) => line.toLowerCase().includes(q))
			.join('\n');
	}

	async function copyRaw(text: string): Promise<void> {
		await copyWithToast(text, 'Raw metrics copied');
	}

	async function loadRaw(): Promise<void> {
		rawLoading = true;
		rawError = null;
		try {
			rawText = await getAdminMetricsRaw();
		} catch (err) {
			rawError = err instanceof Error ? err.message : String(err);
		} finally {
			rawLoading = false;
		}
	}

	function onRawToggle(event: Event): void {
		const open = (event.currentTarget as HTMLDetailsElement).open;
		if (open && rawText === null && !rawLoading) void loadRaw();
	}
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Overview" description="Live process and cluster health for Quickwit.">
		{#snippet actions()}
			<button class="text-base-content/60 hover:text-base-content text-xs" onclick={refresh}>
				Refresh
			</button>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		<ClusterIdentityStrip
			state={connectionState}
			endpoint={cluster?.health.endpoint ?? null}
			version={poller.metrics?.build.version ?? null}
			commitHash={poller.metrics?.build.commitHash ?? null}
			buildDate={poller.metrics?.build.buildDate ?? null}
		/>

		<HeadlineNumbers totals={cluster?.totals ?? null} live={poller.liveSummary} />

		{#if poller.unavailable}
			<div class="border-error/40 bg-error/5 text-error rounded border px-4 py-2 text-xs">
				Quickwit metrics unavailable ({poller.failures} consecutive failures).
				<button class="ml-2 underline" onclick={() => poller.poll()}>Retry now</button>
			</div>
		{:else if poller.stale}
			<div class="text-base-content/60 text-xs">
				Live metrics stale — last update {poller.staleSeconds}s ago.
			</div>
		{/if}

		{#if clusterError}
			<div class="border-error/40 bg-error/5 text-error rounded border px-4 py-3 text-xs">
				Cluster overview unavailable: {clusterError}
				<button class="ml-2 underline" onclick={refresh}>Retry</button>
			</div>
		{:else if cluster && cluster.perIndex.length === 0}
			<div class="border-line text-base-content/60 rounded-box border px-4 py-6 text-sm">
				No indexes yet — create one to start tracking.
			</div>
		{:else if cluster}
			<StorageTrendChart
				indexes={cluster.perIndex}
				{histories}
				{range}
				{onRangeChange}
				loading={historiesLoading}
			/>
			{#if Object.keys(historyErrors).length > 0}
				<div class="border-error/40 bg-error/5 text-error rounded border px-4 py-2 text-xs">
					<p class="font-medium">History fetch errors</p>
					<ul class="mt-1 list-disc pl-5">
						{#each Object.entries(historyErrors) as [id, msg] (id)}
							<li><span class="font-mono">{id}</span>: {msg}</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</div>

	<details class="border-line rounded-box group mt-10 border px-4 py-3" ontoggle={onRawToggle}>
		<summary
			class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center justify-between text-xs"
		>
			<span class="eyebrow">Raw metrics</span>
			<span class="text-base-content/40 text-[10px] group-open:hidden">expand</span>
			<span class="text-base-content/40 hidden text-[10px] group-open:inline">collapse</span>
		</summary>
		<div class="mt-4 flex flex-col gap-3">
			<div class="flex items-center gap-3">
				<input
					type="text"
					placeholder="Filter lines (e.g. 'ingest', 'search_root')"
					class="input input-sm flex-1"
					bind:value={rawFilter}
					disabled={rawText === null}
				/>
				<button
					class="btn btn-sm"
					onclick={loadRaw}
					disabled={rawLoading}
					title="Refresh raw metrics"
				>
					{rawLoading ? 'Loading…' : 'Refresh'}
				</button>
				<button
					class="btn btn-sm"
					onclick={() => rawText && copyRaw(rawText)}
					disabled={rawText === null}
				>
					Copy all
				</button>
			</div>
			{#if rawError}
				<div class="border-error/40 bg-error/5 text-error rounded border px-4 py-2 text-xs">
					Raw metrics unavailable: {rawError}
				</div>
			{:else if rawLoading && rawText === null}
				<div class="text-base-content/40 px-4 py-6 text-center text-xs">Loading raw metrics…</div>
			{:else if rawText !== null}
				<pre
					class="border-line rounded-box max-h-[60vh] overflow-auto border p-4 font-mono text-xs leading-relaxed">{filteredRaw(
						rawText,
						rawFilter
					)}</pre>
			{/if}
		</div>
	</details>
</div>
