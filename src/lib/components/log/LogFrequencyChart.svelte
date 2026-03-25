<script lang="ts">
	import { browser } from '$app/environment';
	import type uPlotLib from 'uplot';
	import type { TimezoneMode } from '$lib/types';
	import { formatChartTime, formatChartDate, formatChartTooltip } from '$lib/utils/time';
	import CollapsibleSection from '$lib/components/ui/CollapsibleSection.svelte';

	let {
		data,
		timezoneMode,
		loading,
		collapsed = $bindable(false),
		onbrush
	}: {
		data: { timestamp: number; levels: Record<string, number> }[];
		timezoneMode: TimezoneMode;
		loading: boolean;
		collapsed: boolean;
		onbrush: (start: number, end: number) => void;
	} = $props();

	const LEVEL_ORDER = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'CRITICAL', 'FATAL'] as const;

	const LEVEL_COLORS: Record<string, string> = {
		DEBUG: '#22d3ee',
		INFO: '#3b82f6',
		WARN: '#f59e0b',
		WARNING: '#f59e0b',
		ERROR: '#ef4444',
		CRITICAL: '#ec4899',
		FATAL: '#ec4899'
	};

	const FALLBACK_COLOR = '#8b5cf6';

	let containerEl = $state<HTMLDivElement | null>(null);
	let chartEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(400);
	let chart: uPlotLib | null = null;
	let uPlotCtor: typeof uPlotLib | null = null;

	// Collect all unique levels from data in the defined stacking order
	let levels = $derived.by(() => {
		const seen = new Set<string>();
		for (const bucket of data) {
			for (const key of Object.keys(bucket.levels)) {
				seen.add(key.toUpperCase());
			}
		}
		const ordered: string[] = [];
		for (const level of LEVEL_ORDER) {
			if (seen.has(level)) {
				ordered.push(level);
				seen.delete(level);
			}
		}
		// Any remaining levels not in LEVEL_ORDER
		for (const level of seen) {
			ordered.push(level);
		}
		return ordered;
	});

	// Build columnar data for uPlot: { uplot: [timestamps, ...stackedSeries], rawSeries }
	let columnarData = $derived.by(() => {
		if (data.length === 0) return null;

		const timestamps: number[] = data.map((b) => b.timestamp);
		const rawSeries: number[][] = levels.map((level) =>
			data.map((b) => {
				// Match case-insensitively
				const key = Object.keys(b.levels).find((k) => k.toUpperCase() === level);
				return key ? (b.levels[key] ?? 0) : 0;
			})
		);

		// Build stacked series (cumulative)
		const stackedSeries: number[][] = [];
		for (let i = 0; i < rawSeries.length; i++) {
			const stacked = new Array<number>(timestamps.length);
			for (let j = 0; j < timestamps.length; j++) {
				stacked[j] = rawSeries[i][j] + (i > 0 ? stackedSeries[i - 1][j] : 0);
			}
			stackedSeries.push(stacked);
		}

		return {
			uplot: [timestamps, ...stackedSeries] as [number[], ...number[][]],
			rawSeries
		};
	});

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipLeft = $state(0);
	let tooltipTop = $state(0);
	let tooltipIdx = $state<number | null>(null);

	function destroyChart() {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	}

	async function buildChart() {
		if (!browser || !chartEl || collapsed || !columnarData) return;

		// Sync width from actual DOM before building — ResizeObserver is async
		// and may not have fired yet, so chartWidth could still be the 400px default
		if (containerEl) {
			const actualWidth = containerEl.clientWidth;
			if (actualWidth > 0) {
				chartWidth = actualWidth;
			}
		}

		destroyChart();

		if (!uPlotCtor) {
			const mod = await import('uplot');
			uPlotCtor = mod.default;
		}

		// Re-check state after async import — user may have collapsed or unmounted
		if (!chartEl || collapsed || !columnarData) return;

		const UPlot = uPlotCtor;

		const barPaths = UPlot.paths.bars!({ size: [0.96, 64, 1], align: 0, gap: 1 });

		const series: uPlotLib.Series[] = [
			{
				label: 'Time'
			}
		];

		const bands: uPlotLib.Band[] = [];

		for (let i = 0; i < levels.length; i++) {
			const level = levels[i];
			const color = LEVEL_COLORS[level] ?? FALLBACK_COLOR;

			series.push({
				label: level,
				fill: color,
				stroke: color,
				width: 0,
				paths: barPaths,
				points: { show: false }
			});

			// Bands connect stacked series for fill between them
			if (i > 0) {
				bands.push({
					series: [i + 1, i] as [number, number],
					fill: LEVEL_COLORS[levels[i]] ?? FALLBACK_COLOR
				});
			}
		}

		// Determine time span to choose label formatter
		const timestamps = columnarData.uplot[0];
		const span = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
		const SECONDS_PER_DAY = 86400;
		const useDate = span > SECONDS_PER_DAY;
		// Pad x-range by half a bucket so first/last bars aren't clipped
		const bucketWidth = timestamps.length > 1 ? timestamps[1] - timestamps[0] : 1;
		const halfBucket = bucketWidth / 2;

		const opts: uPlotLib.Options = {
			width: chartWidth,
			height: 150,
			series,
			bands,
			cursor: {
				drag: {
					x: true,
					y: false,
					setScale: false
				}
			},
			select: {
				show: true,
				left: 0,
				top: 0,
				width: 0,
				height: 0
			},
			legend: {
				show: false
			},
			scales: {
				x: {
					time: true,
					range: (_u: uPlotLib, min: number, max: number) => [min - halfBucket, max + halfBucket]
				},
				y: {
					range: (_u: uPlotLib, _min: number, max: number) => [0, max || 1]
				}
			},
			axes: [
				{
					stroke: '#9ca3af',
					grid: { show: false },
					ticks: { show: false },
					gap: 2,
					size: 20,
					space: 120,
					values: (_u: uPlotLib, splits: number[]) =>
						splits.map((v) =>
							useDate ? formatChartDate(v, timezoneMode) : formatChartTime(v, timezoneMode)
						)
				},
				{
					stroke: '#9ca3af',
					grid: { show: true, stroke: 'rgba(156,163,175,0.15)', width: 0.8 },
					ticks: { show: false },
					size: 50
				}
			],
			hooks: {
				setSelect: [
					(u: uPlotLib) => {
						const left = u.select.left;
						const width = u.select.width;
						if (width > 2) {
							const startTs = Math.floor(u.posToVal(left, 'x'));
							const endTs = Math.ceil(u.posToVal(left + width, 'x'));
							onbrush(startTs, endTs);
						}
						u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
					}
				],
				setCursor: [
					(u: uPlotLib) => {
						const idx = u.cursor.idx;
						if (idx == null) {
							tooltipVisible = false;
							tooltipIdx = null;
							return;
						}

						tooltipIdx = idx;
						tooltipVisible = true;

						const over = u.over;
						const left = u.cursor.left ?? 0;
						const top = u.cursor.top ?? 0;
						const overRect = over.getBoundingClientRect();
						const containerRect = containerEl?.getBoundingClientRect();
						if (!containerRect) return;

						const offsetLeft = overRect.left - containerRect.left;
						const offsetTop = overRect.top - containerRect.top;

						const tooltipWidth = 180;
						const cursorAbsLeft = offsetLeft + left;

						// Flip tooltip to the left when it would overflow
						if (cursorAbsLeft + tooltipWidth + 12 > containerRect.width) {
							tooltipLeft = cursorAbsLeft - tooltipWidth - 8;
						} else {
							tooltipLeft = cursorAbsLeft + 12;
						}

						tooltipTop = offsetTop + top - 10;
					}
				]
			}
		};

		chart = new UPlot(opts, columnarData.uplot, chartEl);
	}

	// ResizeObserver for responsive width
	$effect(() => {
		if (!browser || !containerEl) return;

		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const w = entry.contentRect.width;
				if (w > 0 && Math.abs(w - chartWidth) > 1) {
					chartWidth = w;
				}
			}
		});

		ro.observe(containerEl);

		return () => ro.disconnect();
	});

	// Rebuild chart when data, timezoneMode, or collapsed state changes
	$effect(() => {
		// Track reactive dependencies (not chartWidth -- resize is handled separately)
		void columnarData;
		void timezoneMode;
		void collapsed;

		if (browser && !collapsed && columnarData && chartEl) {
			buildChart();
		} else if (collapsed) {
			destroyChart();
		}

		return () => {
			destroyChart();
		};
	});

	// Resize chart when width changes (without full rebuild)
	$effect(() => {
		if (chart && chartWidth > 0) {
			chart.setSize({ width: chartWidth, height: 150 });
		}
	});

	// Re-sync chart size when returning to the tab
	$effect(() => {
		if (!browser) return;

		const handleVisibility = () => {
			if (document.visibilityState === 'visible' && chart && containerEl) {
				const w = containerEl.clientWidth;
				if (w > 0 && Math.abs(w - chartWidth) > 1) {
					chartWidth = w;
				}
			}
		};

		document.addEventListener('visibilitychange', handleVisibility);
		return () => document.removeEventListener('visibilitychange', handleVisibility);
	});
</script>

<div class="relative z-20 border-b border-base-300">
	<CollapsibleSection title="Frequency chart" bind:collapsed>
		{#snippet headerActions()}
			{#if loading}
				<span class="loading loading-xs loading-spinner text-base-content/60"></span>
			{/if}
		{/snippet}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={containerEl}
			class="relative px-2 pb-2"
			onmouseleave={() => {
				tooltipVisible = false;
				tooltipIdx = null;
			}}
		>
			<div bind:this={chartEl}></div>

			{#if tooltipVisible && tooltipIdx != null && columnarData}
				<div
					class="pointer-events-none absolute z-10 rounded border border-base-300 bg-base-100 px-2.5 py-1.5 shadow-lg"
					style="left: {tooltipLeft}px; top: {tooltipTop}px;"
				>
					<div class="mb-1 text-[11px] text-base-content/60">
						{formatChartTooltip(columnarData.uplot[0][tooltipIdx], timezoneMode)}
					</div>
					{#each levels as level, i (level)}
						{@const count = columnarData.rawSeries[i][tooltipIdx]}
						{#if count > 0}
							<div class="flex items-center gap-1.5 text-xs">
								<span
									class="inline-block h-2 w-2 rounded-sm"
									style="background-color: {LEVEL_COLORS[level] ?? FALLBACK_COLOR}"
								></span>
								<span class="text-base-content/80">{level}</span>
								<span class="ml-auto font-mono text-base-content">{count}</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</CollapsibleSection>
</div>
