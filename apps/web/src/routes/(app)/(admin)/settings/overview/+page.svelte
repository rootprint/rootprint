<script lang="ts">
	import { onMount } from 'svelte';

	import {
		getAdminMetrics,
		getAdminMetricsRaw,
		getClusterOverview,
		type AdminMetrics
	} from '#lib/api/admin.js';
	import { windowToSpanMs, type Window } from '#lib/utils/time-range.js';
	import { getIndexStats } from '#lib/api/indexes.js';
	import ClusterIdentityStrip from '#lib/components/settings/overview/ClusterIdentityStrip.svelte';
	import HeadlineNumbers from '#lib/components/settings/overview/HeadlineNumbers.svelte';
	import StorageTrendChart from '#lib/components/settings/overview/StorageTrendChart.svelte';
	import CopyButton from '#lib/components/ui/CopyButton.svelte';
	import EmptyPanel from '#lib/components/ui/EmptyPanel.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import PanelError from '#lib/components/ui/PanelError.svelte';
	import type { ConnectionState } from '#lib/types.js';

	type StatsPoint = Awaited<ReturnType<typeof getIndexStats>>['points'][number];

	const METRICS_POLL_MS = 5000;

	let { data } = $props();

	let range = $state<Window>('7d');

	let cluster = $state(data.cluster);
	let clusterError = $state(data.clusterError);
	let histories = $state<Record<string, StatsPoint[]>>({});
	let historyErrors = $state<Record<string, string>>({});
	let historiesLoading = $state(false);
	let historiesToken = 0;

	let metrics = $state<AdminMetrics | null>(null);
	let metricsError = $state<string | null>(null);

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
		const endTs = Math.floor(Date.now() / 1000);
		const startTs = endTs - windowToSpanMs(range) / 1000;
		const next: Record<string, StatsPoint[]> = {};
		await Promise.all(
			cluster.perIndex.map(async (i) => {
				try {
					const body = await getIndexStats(i.indexId, { startTs, endTs });
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

	async function pollMetrics(): Promise<void> {
		try {
			metrics = await getAdminMetrics();
			metricsError = null;
		} catch (err) {
			metricsError = err instanceof Error ? err.message : String(err);
		}
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
		void pollMetrics();
		// ponytail: polls a hidden tab too and lets slow polls overlap; fine for 3 gauges
		const timer = setInterval(pollMetrics, METRICS_POLL_MS);
		return () => clearInterval(timer);
	});

	const connectionState = $derived.by<ConnectionState>(() => {
		if (clusterError !== null || metricsError !== null) return 'disconnected';
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

<div class="settings-page">
	<PageHeader title="Overview" description="Live process and cluster health for Quickwit.">
		{#snippet actions()}
			<button class="text-muted hover:text-base-content text-xs" onclick={refresh}>
				Refresh
			</button>
		{/snippet}
	</PageHeader>

	<div class="mt-8 flex flex-col gap-4">
		<ClusterIdentityStrip
			state={connectionState}
			endpoint={cluster?.health.endpoint ?? null}
			version={metrics?.build.version ?? null}
			commitHash={metrics?.build.commitHash ?? null}
			buildDate={metrics?.build.buildDate ?? null}
			clusterId={cluster?.health.clusterId ?? null}
			liveNodes={cluster?.health.liveNodes ?? null}
			deadNodes={cluster?.health.deadNodes ?? null}
		/>

		<HeadlineNumbers
			totals={cluster?.totals ?? null}
			live={metrics && { ...metrics.resources, ...metrics.saturation }}
		/>

		{#if metricsError}
			<PanelError message={`Quickwit metrics unavailable: ${metricsError}`} retry={pollMetrics} />
		{/if}

		{#if clusterError}
			<PanelError message={`Cluster overview unavailable: ${clusterError}`} retry={refresh} />
		{:else if cluster && cluster.perIndex.length === 0}
			<EmptyPanel title="No indexes yet">Create one to start tracking.</EmptyPanel>
		{:else if cluster}
			<StorageTrendChart
				indexes={cluster.perIndex}
				{histories}
				{range}
				{onRangeChange}
				loading={historiesLoading}
			/>
			{#if Object.keys(historyErrors).length > 0}
				<PanelError
					message={`History unavailable for ${Object.keys(historyErrors).join(', ')}`}
					error={new Error(
						Object.entries(historyErrors)
							.map(([id, msg]) => `${id}: ${msg}`)
							.join('; ')
					)}
					retry={() => void loadHistories()}
				/>
			{/if}
		{/if}
	</div>

	<details class="border-line rounded-box group mt-10 border px-4 py-3" ontoggle={onRawToggle}>
		<summary
			class="text-muted hover:text-base-content flex cursor-pointer items-center justify-between text-xs"
		>
			<span class="section-label">Raw metrics</span>
			<span class="text-muted text-xs group-open:hidden">expand</span>
			<span class="text-muted hidden text-xs group-open:inline">collapse</span>
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
					class="btn btn-ghost btn-sm"
					onclick={loadRaw}
					disabled={rawLoading}
					title="Refresh raw metrics"
				>
					{rawLoading ? 'Loading…' : 'Refresh'}
				</button>
				<CopyButton text={rawText ?? ''} class="btn btn-ghost btn-sm" disabled={rawText === null}>
					Copy all
				</CopyButton>
			</div>
			{#if rawError}
				<PanelError message={`Raw metrics unavailable: ${rawError}`} retry={() => void loadRaw()} />
			{:else if rawLoading && rawText === null}
				<div class="text-muted px-4 py-6 text-center text-xs">Loading raw metrics…</div>
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
