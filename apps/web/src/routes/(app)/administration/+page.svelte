<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { InferResponseType } from 'hono/client';

	import { client } from '$lib/api/client';
	import ClusterIdentityStrip from '$lib/components/admin/ClusterIdentityStrip.svelte';
	import HeadlineNumbers from '$lib/components/admin/HeadlineNumbers.svelte';
	import { rangeToSpanMs, type Range } from '$lib/components/admin/RangePicker.svelte';
	import StorageTrendChart from '$lib/components/admin/StorageTrendChart.svelte';

	type ClusterOverview = InferResponseType<typeof client.api.admin.cluster.$get, 200>;
	type MetricsResponse = InferResponseType<typeof client.api.admin.metrics.$get, 200>;
	type StatsResponse = InferResponseType<
		(typeof client.api.indexes)[':indexId']['stats']['$get'],
		200
	>;
	type StatsPoint = StatsResponse['points'][number];

	const METRICS_POLL_MS = 5000;
	const MAX_METRICS_FAILURES = 3;

	let range = $state<Range>('7d');

	let cluster = $state<ClusterOverview | null>(null);
	let clusterError = $state<string | null>(null);
	let histories = $state<Record<string, StatsPoint[]>>({});
	let historyErrors = $state<Record<string, string>>({});
	let loadingHistories = $state(false);
	let historiesToken = 0;

	let metrics = $state<MetricsResponse | null>(null);
	let metricsFailures = $state(0);
	let lastMetricsAt = $state<number | null>(null);
	let now = $state(Date.now());

	let metricsTimer: ReturnType<typeof setTimeout> | null = null;
	let rawFilter = $state('');
	let rawText = $state<string | null>(null);
	let rawLoading = $state(false);
	let rawError = $state<string | null>(null);

	async function loadCluster(): Promise<void> {
		clusterError = null;
		try {
			const res = await client.api.admin.cluster.$get();
			if (!res.ok) {
				clusterError = `HTTP ${res.status}`;
				return;
			}
			cluster = await res.json();
		} catch (err) {
			clusterError = err instanceof Error ? err.message : String(err);
		}
	}

	async function loadHistories(): Promise<void> {
		if (!cluster) return;
		const token = ++historiesToken;
		loadingHistories = true;
		const newErrors: Record<string, string> = {};
		const span = rangeToSpanMs(range);
		const to = Date.now();
		const from = to - span;
		const next: Record<string, StatsPoint[]> = {};
		await Promise.all(
			cluster.perIndex.map(async (i) => {
				try {
					const res = await client.api.indexes[':indexId'].stats.$get({
						param: { indexId: i.indexId },
						query: { from: String(from), to: String(to), limit: '10000' }
					});
					if (!res.ok) {
						newErrors[i.indexId] = `HTTP ${res.status}`;
						return;
					}
					const body = await res.json();
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
		loadingHistories = false;
	}

	async function refresh(): Promise<void> {
		await loadCluster();
		await loadHistories();
	}

	function onRangeChange(next: Range): void {
		range = next;
		void loadHistories();
	}

	async function pollMetrics(): Promise<void> {
		try {
			const res = await client.api.admin.metrics.$get();
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			metrics = await res.json();
			lastMetricsAt = Date.now();
			metricsFailures = 0;
		} catch {
			metricsFailures += 1;
		}
	}

	function scheduleMetrics(): void {
		stopMetrics();
		metricsTimer = setTimeout(async () => {
			await pollMetrics();
			now = Date.now();
			scheduleMetrics();
		}, METRICS_POLL_MS);
	}

	function stopMetrics(): void {
		if (metricsTimer !== null) {
			clearTimeout(metricsTimer);
			metricsTimer = null;
		}
	}

	function onVisibility(): void {
		if (document.visibilityState === 'hidden') {
			stopMetrics();
		} else {
			void pollMetrics();
			scheduleMetrics();
		}
	}

	onMount(() => {
		void refresh();
		void pollMetrics();
		scheduleMetrics();
		document.addEventListener('visibilitychange', onVisibility);
	});

	onDestroy(() => {
		stopMetrics();
		document.removeEventListener('visibilitychange', onVisibility);
	});

	const healthState = $derived.by<'healthy' | 'unhealthy' | 'unreachable' | 'loading'>(() => {
		if (clusterError !== null) return 'unreachable';
		if (cluster === null) return 'loading';
		return cluster.health.healthy ? 'healthy' : 'unhealthy';
	});

	const liveSummary = $derived.by(() => {
		if (!metrics) return null;
		return {
			cpuBusyRatio: metrics.saturation.cpuBusyRatio,
			memoryRssBytes: metrics.resources.memoryRssBytes,
			fdsOpen: metrics.resources.fdsOpen,
			fdsMax: metrics.resources.fdsMax,
			walDiskBytes: metrics.resources.walDiskBytes
		};
	});

	const staleSeconds = $derived.by(() => {
		if (lastMetricsAt === null) return null;
		return Math.max(0, Math.floor((now - lastMetricsAt) / 1000));
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
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// ignore
		}
	}

	async function loadRaw(): Promise<void> {
		rawLoading = true;
		rawError = null;
		try {
			const res = await client.api.admin.metrics.raw.$get();
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			rawText = await res.text();
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

<div class="mx-auto max-w-5xl px-12 py-12">
	<div class="flex items-start justify-between gap-6">
		<div>
			<p class="eyebrow">Administration</p>
			<h1 class="text-h1 mt-3">Overview</h1>
			<p class="text-base-content/60 mt-3 max-w-2xl text-sm">
				Live process and cluster health for Quickwit.
			</p>
		</div>
		<div class="mt-1 flex shrink-0 items-center gap-3">
			<button
				class="text-base-content/60 hover:text-base-content text-xs"
				onclick={refresh}
			>
				Refresh
			</button>
		</div>
	</div>

	<div class="mt-8 flex flex-col gap-4">
		<ClusterIdentityStrip
			state={healthState}
			endpoint={cluster?.health.endpoint ?? null}
			version={metrics?.build.version ?? null}
			uptimeSeconds={metrics?.uptimeSeconds ?? null}
		/>

		<HeadlineNumbers totals={cluster?.totals ?? null} live={liveSummary} />

		{#if metricsFailures >= MAX_METRICS_FAILURES}
			<div class="border-error/40 bg-error/5 text-error rounded border px-4 py-2 text-xs">
				Quickwit metrics unavailable ({metricsFailures} consecutive failures).
				<button class="ml-2 underline" onclick={pollMetrics}>Retry now</button>
			</div>
		{:else if staleSeconds !== null && staleSeconds > METRICS_POLL_MS / 1000 + 2}
			<div class="text-base-content/60 text-xs">
				Live metrics stale — last update {staleSeconds}s ago.
			</div>
		{/if}

		{#if clusterError}
			<div class="border-error/40 bg-error/5 text-error rounded border px-4 py-3 text-xs">
				Cluster overview unavailable: {clusterError}
				<button class="ml-2 underline" onclick={loadCluster}>Retry</button>
			</div>
		{:else if cluster && cluster.perIndex.length === 0}
			<div class="hairline text-base-content/60 rounded-box px-4 py-6 text-sm">
				No indexes yet — create one to start tracking.
			</div>
		{:else if cluster}
			<StorageTrendChart
				indexes={cluster.perIndex}
				{histories}
				{range}
				{onRangeChange}
				loading={loadingHistories}
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

	<details class="hairline rounded-box group mt-10 px-4 py-3" ontoggle={onRawToggle}>
		<summary class="text-base-content/70 hover:text-base-content flex cursor-pointer items-center justify-between text-xs">
			<span class="eyebrow">Raw metrics</span>
			<span class="text-base-content/40 text-[10px] group-open:hidden">expand</span>
			<span class="text-base-content/40 hidden text-[10px] group-open:inline">collapse</span>
		</summary>
		<div class="mt-4 flex flex-col gap-3">
			<div class="flex items-center gap-3">
				<input
					type="text"
					placeholder="Filter lines (e.g. 'ingest', 'search_root')"
					class="input input-sm input-bordered flex-1"
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
					class="hairline rounded-box max-h-[60vh] overflow-auto p-4 font-mono text-xs leading-relaxed">{filteredRaw(
						rawText,
						rawFilter
					)}</pre>
			{/if}
		</div>
	</details>
</div>
