<script lang="ts">
	import type uPlotLib from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	import { untrack, type Snippet } from 'svelte';

	import { browser } from '$app/environment';

	let {
		data,
		height,
		makeOpts,
		tooltipWidth = 180,
		tooltip,
		onbuild
	}: {
		data: uPlotLib.AlignedData | null;
		height: number;
		makeOpts: (UPlot: typeof uPlotLib) => Omit<uPlotLib.Options, 'width' | 'height'>;
		tooltipWidth?: number;
		tooltip: Snippet<[number]>;
		onbuild?: (chart: uPlotLib) => void;
	} = $props();

	const TOOLTIP_GAP = 12;
	const TOOLTIP_VERTICAL_NUDGE = 10;

	let containerEl = $state<HTMLDivElement | null>(null);
	let chartEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(400);
	let ctor = $state<typeof uPlotLib | null>(null);
	let chart: uPlotLib | null = null;

	let tooltipVisible = $state(false);
	let tooltipLeft = $state(0);
	let tooltipTop = $state(0);
	let tooltipIdx = $state<number | null>(null);

	const opts = $derived(ctor ? makeOpts(ctor) : null);

	function updateTooltip(u: uPlotLib) {
		const idx = u.cursor.idx;
		if (idx == null) {
			tooltipVisible = false;
			tooltipIdx = null;
			return;
		}
		const containerRect = containerEl?.getBoundingClientRect();
		if (!containerRect) return;

		const overRect = u.over.getBoundingClientRect();
		const cursorAbsLeft = overRect.left - containerRect.left + (u.cursor.left ?? 0);

		tooltipIdx = idx;
		tooltipLeft =
			cursorAbsLeft + tooltipWidth + TOOLTIP_GAP > containerRect.width
				? cursorAbsLeft - tooltipWidth - TOOLTIP_GAP
				: cursorAbsLeft + TOOLTIP_GAP;
		tooltipTop = overRect.top - containerRect.top + (u.cursor.top ?? 0) - TOOLTIP_VERTICAL_NUDGE;
		tooltipVisible = true;
	}

	$effect(() => {
		if (!browser || ctor) return;
		let cancelled = false;
		import('uplot').then((mod) => {
			if (!cancelled) ctor = mod.default;
		});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!browser || !containerEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const w = entry.contentRect.width;
				if (w > 0 && Math.abs(w - chartWidth) > 1) chartWidth = w;
			}
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		const UPlot = ctor;
		const built = opts;
		if (!UPlot || !built || !data || !chartEl) return;

		const width = untrack(() => {
			const measured = containerEl?.clientWidth ?? 0;
			if (measured > 0) chartWidth = measured;
			return chartWidth;
		});

		const instance = new UPlot(
			{
				legend: { show: false }, // uPlot's own legend would duplicate the `tooltip` snippet
				...built,
				width,
				height,
				hooks: { ...built.hooks, setCursor: [...(built.hooks?.setCursor ?? []), updateTooltip] }
			},
			data,
			chartEl
		);
		chart = instance;
		onbuild?.(instance);

		return () => {
			instance.destroy();
			chart = null;
		};
	});

	$effect(() => {
		const size = { width: chartWidth, height };
		if (chart && size.width > 0) chart.setSize(size);
	});

	$effect(() => {
		if (!browser) return;
		const handle = () => {
			if (document.visibilityState === 'visible' && chart && containerEl) {
				const w = containerEl.clientWidth;
				if (w > 0 && Math.abs(w - chartWidth) > 1) chartWidth = w;
			}
		};
		document.addEventListener('visibilitychange', handle);
		return () => document.removeEventListener('visibilitychange', handle);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={containerEl}
	class="relative w-full"
	onmouseleave={() => {
		tooltipVisible = false;
		tooltipIdx = null;
	}}
>
	<div bind:this={chartEl}></div>
	{#if tooltipVisible && tooltipIdx != null && data && tooltipIdx < data[0].length}
		<div
			class="border-base-300/50 bg-base-100 pointer-events-none absolute z-20 grid items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
			style="left: {tooltipLeft}px; top: {tooltipTop}px; min-width: {tooltipWidth}px;"
		>
			{@render tooltip(tooltipIdx)}
		</div>
	{/if}
</div>
