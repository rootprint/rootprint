<script lang="ts">
	import { Check, Copy, Search } from 'lucide-svelte';

	import { page } from '$app/state';
	import TracePane from '$lib/components/trace/TracePane.svelte';
	import { TraceLoader } from '$lib/components/trace/trace-loader.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { formatSpanDuration } from '$lib/utils/time';
	import type { BreadcrumbSegment } from '$lib/types';

	const traceId = $derived(page.params.traceId ?? '');
	const segments = $derived<BreadcrumbSegment[]>([
		{ label: 'Logs', href: '/' },
		{ label: `Trace ${traceId}`, mono: true }
	]);

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
			<Breadcrumb {segments} />
			{#if ready && loader}
				<div class="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
					{#if root}
						<span class="shrink-0 font-medium">{root.serviceName}</span>
						<span class="text-base-content/50 min-w-0 truncate">{root.name}</span>
					{/if}
					<span class="badge badge-sm badge-ghost tabular-nums">
						{formatSpanDuration(loader.durationMicros)}
					</span>
					<span class="badge badge-sm badge-ghost tabular-nums">
						{loader.spanCount} span{loader.spanCount === 1 ? '' : 's'}
					</span>
					<span class="badge badge-sm badge-ghost tabular-nums">
						{loader.serviceCount} service{loader.serviceCount === 1 ? '' : 's'}
					</span>
					{#if loader.errorCount > 0}
						<span class="badge badge-sm badge-error badge-soft tabular-nums">
							{loader.errorCount} error{loader.errorCount === 1 ? '' : 's'}
						</span>
					{/if}
				</div>
			{/if}
		</div>
		<CopyButton text={traceId} class="btn btn-ghost btn-xs shrink-0" ariaLabel="Copy trace ID">
			{#snippet children({ copied }: { copied: boolean })}
				{#if copied}
					<Check class="h-3.5 w-3.5" />
					Copied
				{:else}
					<Copy class="h-3.5 w-3.5" />
					Copy ID
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
