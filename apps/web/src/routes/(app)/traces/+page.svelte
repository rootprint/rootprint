<script lang="ts">
	import { RefreshCw } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { fetchTraceHistogram } from '$lib/api/traces';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import TraceHeatmap from '$lib/components/trace/TraceHeatmap.svelte';
	import type { TimeRange, TraceHistogramResponse } from '$lib/types';
	import { clearLastIndex, readLastIndex, writeLastIndex } from '$lib/utils/last-index';
	import { buildQueryUrl, deserialize } from '$lib/utils/query-params';

	let { data } = $props();

	const parsed = $derived(deserialize(page.url.searchParams));
	const timeRange = $derived(parsed.timeRange);
	const selectedIndex = $derived(
		parsed.index !== null && data.indexes.some((i) => i.id === parsed.index)
			? parsed.index
			: (data.indexes[0]?.id ?? null)
	);

	let heatmap = $state<TraceHistogramResponse | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let refreshNonce = $state(0);

	const isAdmin = $derived(
		(page.data.session?.user as { role?: string } | undefined)?.role === 'admin'
	);

	let abort: AbortController | null = null;
	let chartedIndex: string | null = null;

	function navigate(partial: Parameters<typeof buildQueryUrl>[1], opts?: { push?: boolean }): void {
		void goto(buildQueryUrl(page.url.searchParams, partial), {
			replaceState: !opts?.push,
			keepFocus: true,
			noScroll: true
		});
	}

	// Canonicalization and the fetch share one effect, like the log explorer's: `goto` is async, so a
	// separate fetch effect would fire against the fallback index first.
	$effect(() => {
		if (parsed.index === null) {
			const remembered = readLastIndex('traces');
			if (remembered !== null && data.indexes.some((i) => i.id === remembered)) {
				navigate({ index: remembered });
				return;
			}
			if (remembered !== null) clearLastIndex('traces');
		}
		const indexId = selectedIndex;
		if (indexId === null) return;
		if (parsed.index !== indexId) {
			navigate({ index: indexId });
			return;
		}
		writeLastIndex('traces', indexId);

		const range = timeRange;
		// Refresh and retry change neither the index nor the range, so the nonce is what re-runs this.
		void refreshNonce;

		// Every superseded request is aborted here, so `signal.aborted` is the whole staleness check.
		abort?.abort();
		const ctl = new AbortController();
		abort = ctl;
		// Another index's grid or error must not stay on screen while this one loads — its counts would
		// read as the newly selected index's.
		if (indexId !== chartedIndex) heatmap = null;
		chartedIndex = indexId;
		error = null;
		loading = true;

		fetchTraceHistogram({ indexId, timeRange: range }, ctl.signal)
			.then((result) => {
				if (!ctl.signal.aborted) heatmap = result;
			})
			.catch((e) => {
				if (ctl.signal.aborted) return;
				error = e instanceof Error ? e.message : 'Failed to load traces';
			})
			.finally(() => {
				if (!ctl.signal.aborted) loading = false;
			});
	});

	$effect(() => () => abort?.abort());

	function onTimeRange(next: TimeRange): void {
		navigate({ timeRange: next });
	}
</script>

{#if data.indexes.length === 0}
	<div class="bg-base-200/30 flex h-full min-h-0 w-full items-center justify-center p-8">
		<section class="border-line bg-base-100 rounded-box w-full max-w-md border p-6">
			<p class="eyebrow">Traces</p>
			<h1 class="mt-1 text-xl tracking-tight">No index has traces</h1>
			<p class="text-base-content/60 mt-3 text-sm leading-6">
				Traces show up here once a log index is paired with a trace index.
			</p>
			{#if isAdmin}
				<a href="/settings/indexes" class="btn btn-primary btn-sm mt-6">Open index settings</a>
			{/if}
		</section>
	</div>
{:else}
	<div class="bg-base-100 flex h-full min-h-0 w-full flex-col">
		<div
			class="border-line flex h-12 shrink-0 items-center gap-2 border-b px-3"
			aria-label="Trace search"
		>
			<select
				class="select select-sm w-48 font-mono text-xs"
				value={selectedIndex}
				onchange={(e) => navigate({ index: e.currentTarget.value }, { push: true })}
				aria-label="Index"
			>
				{#each data.indexes as option (option.id)}
					<option value={option.id}>{option.name}</option>
				{/each}
			</select>

			<div class="flex-1"></div>

			<TimeRangePicker value={timeRange} onChange={onTimeRange} />

			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => refreshNonce++}
				aria-label="Refresh"
			>
				<RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</div>

		<section
			class="border-line flex h-56 shrink-0 flex-col border-b"
			aria-labelledby="trace-histogram-title"
		>
			<div class="border-line flex h-10 items-center border-b px-4">
				<h1 id="trace-histogram-title" class="eyebrow">Trace duration</h1>
			</div>
			<div class="min-h-0 flex-1">
				<TraceHeatmap data={heatmap} {loading} {error} retry={() => refreshNonce++} />
			</div>
		</section>

		<section class="flex min-h-0 flex-1 flex-col" aria-labelledby="trace-list-title">
			<div class="border-line flex h-10 shrink-0 items-center border-b px-4">
				<h2 id="trace-list-title" class="eyebrow">Trace explorer</h2>
			</div>
			<div class="bg-base-200/30 flex min-h-0 flex-1 items-center justify-center p-4">
				<div
					class="border-line flex h-full w-full items-center justify-center rounded border border-dashed"
				>
					<p class="text-base-content/40 text-xs">Trace list placeholder</p>
				</div>
			</div>
		</section>
	</div>
{/if}
