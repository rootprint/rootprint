<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	import TraceHeatmap from '$lib/components/trace/TraceHeatmap.svelte';
	import type { TraceHistogramResponse } from '$lib/types';
	import { formatDurationMs } from '$lib/utils/format';

	let {
		data,
		loading,
		error,
		retry,
		collapsed = $bindable(false)
	}: {
		data: TraceHistogramResponse | null;
		loading: boolean;
		error: string | null;
		retry: () => void;
		collapsed?: boolean;
	} = $props();

	const bucketWidthLabel = $derived(
		data === null ? null : formatDurationMs(data.intervalSec * 1000)
	);
</script>

<div class="border-line border-b">
	<div class="flex items-center px-3 py-1.5">
		<button
			type="button"
			class="flex flex-1 items-center gap-1.5"
			onclick={() => (collapsed = !collapsed)}
			aria-expanded={!collapsed}
		>
			{#if collapsed}
				<ChevronRight class="text-base-content/40 h-2.5 w-2.5" />
			{:else}
				<ChevronDown class="text-base-content/40 h-2.5 w-2.5" />
			{/if}
			<span
				class="text-base-content/50 text-left text-[14px] tracking-wider uppercase"
				title="Root span durations across the window, under the same filters as the list"
			>
				Root span duration
			</span>
		</button>
		<div
			class="text-base-content/50 flex items-center gap-1.5 text-[12px] tracking-wider uppercase"
		>
			{#if loading}
				<span class="loading loading-spinner loading-xs mr-1"></span>
			{/if}
			{#if bucketWidthLabel !== null}
				<span class="text-base-content/80">{bucketWidthLabel}</span>
				<span>per column</span>
			{/if}
		</div>
	</div>

	{#if !collapsed}
		<div transition:slide={{ duration: 200 }}>
			<div class="h-[150px] px-2 pb-2">
				<TraceHeatmap {data} {loading} {error} {retry} />
			</div>
		</div>
	{/if}
</div>
