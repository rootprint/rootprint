<script lang="ts">
	import { ArrowLeft, Check, Copy, Search } from 'lucide-svelte';

	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import TracePane from '$lib/components/trace/TracePane.svelte';
	import { TraceLoader } from '$lib/components/trace/trace-loader.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { serviceColor } from '$lib/utils/service-color';
	import { formatSpanDuration } from '$lib/utils/time';

	const traceId = $derived(page.params.traceId ?? '');

	// Carries the logs query back with us; a bare '/' would drop the user's search.
	let backHref = $state('/');
	afterNavigate((nav) => {
		const from = nav.from?.url;
		if (from) backHref = `${from.pathname}${from.search}`;
	});

	let loader = $state.raw<TraceLoader | null>(null);
	let filter = $state('');

	$effect(() => {
		const next = new TraceLoader(traceId);
		loader = next;
		filter = '';
		void next.init();
		return () => {
			next.dispose();
		};
	});

	const root = $derived(loader?.roots[0] ?? null);
	const ready = $derived(
		loader !== null && !loader.loading && !loader.error && loader.spanCount > 0
	);
</script>

<div class="flex h-full min-h-0 w-full flex-col">
	<div class="border-line flex items-start justify-between gap-4 border-b px-4 py-3">
		<div class="min-w-0">
			<a href={backHref} class="btn btn-ghost btn-xs -ml-2 gap-1.5">
				<ArrowLeft class="h-3.5 w-3.5" />
				Back to logs
			</a>
			{#if ready && loader}
				<div class="mt-1 flex min-w-0 items-baseline gap-3">
					<h1 class="truncate font-mono text-lg font-medium">{root ? root.name : 'Trace'}</h1>
					<p class="text-base-content/70 shrink-0 font-mono text-lg tabular-nums">
						{formatSpanDuration(loader.durationMicros)}
					</p>
				</div>
				<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
					{#each loader.services as service (service.name)}
						<span class="flex min-w-0 items-center gap-1.5">
							<span
								class="h-2 w-2 shrink-0 rounded-full"
								style={`background-color:${serviceColor(service.name)}`}
							></span>
							<span class="truncate">{service.name}</span>
							<span class="text-base-content/50 tabular-nums">{service.count}</span>
						</span>
					{/each}
					<span class="text-base-content/30">·</span>
					<span class="text-base-content/60 tabular-nums">
						{loader.spanCount} span{loader.spanCount === 1 ? '' : 's'}
					</span>
					{#if loader.errorCount > 0}
						<span class="text-error tabular-nums">
							{loader.errorCount} error{loader.errorCount === 1 ? '' : 's'}
						</span>
					{/if}
				</div>
			{/if}
		</div>
		<CopyButton
			text={traceId}
			class="text-base-content/50 hover:text-base-content flex shrink-0 items-center gap-1 font-mono text-xs"
			ariaLabel="Copy trace ID"
		>
			{#snippet children({ copied }: { copied: boolean })}
				{traceId}
				{#if copied}
					<Check class="h-3 w-3 shrink-0" />
				{:else}
					<Copy class="h-3 w-3 shrink-0" />
				{/if}
			{/snippet}
		</CopyButton>
	</div>

	<div class="border-line border-b px-4 py-2">
		<label class="input input-sm w-full gap-2">
			<Search class="text-base-content/50 h-3.5 w-3.5" />
			<input type="text" placeholder="Search spans" aria-label="Search spans" bind:value={filter} />
		</label>
	</div>

	<div class="min-h-0 flex-1">
		<TracePane {loader} anchorSpanId={null} {filter} />
	</div>
</div>
