<script lang="ts">
	import type uPlotLib from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	import { untrack } from 'svelte';

	import { browser } from '$app/environment';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import type { TraceDurationBand, TraceHeatmapBrush, TraceHistogramResponse } from '$lib/types';
	import { baseContentAt, CANVAS_FALLBACK_COLOR, cssVarColor } from '$lib/utils/chart-colors';
	import { formatDurationMs, pluralize } from '$lib/utils/format';
	import { formatChartDate, formatChartTime, formatChartTooltip } from '$lib/utils/time';

	let {
		data,
		loading,
		error,
		retry,
		onBrush
	}: {
		data: TraceHistogramResponse | null;
		loading: boolean;
		error: string | null;
		retry: () => void;
		onBrush: (sel: TraceHeatmapBrush) => void;
	} = $props();

	const SECONDS_PER_DAY = 86400;
	const Y_AXIS_SIZE = 52;

	/** Defined in `app.css` beside `--trace-service-*`; canvas needs literal colors, hence `cssVarColor`. */
	const HEAT_TOKENS = [
		'--trace-heat-1',
		'--trace-heat-2',
		'--trace-heat-3',
		'--trace-heat-4',
		'--trace-heat-5',
		'--trace-heat-6',
		'--trace-heat-7'
	];
	// Once per mount: `cssVarColor` appends a probe element, and the ramp is rebuilt on every response.
	const heatColors = $derived(
		browser
			? HEAT_TOKENS.map((token) => cssVarColor(`var(${token})`))
			: HEAT_TOKENS.map(() => CANVAS_FALLBACK_COLOR)
	);
	const TOOLTIP_WIDTH = 200;
	const TOOLTIP_GAP_RIGHT = 12;
	const TOOLTIP_GAP_LEFT = 8;
	const TOOLTIP_VERTICAL_NUDGE = 10;

	function bandLabel(band: TraceDurationBand): string {
		if (band.fromMs === null) return `<${formatDurationMs(band.toMs ?? 0)}`;
		return formatDurationMs(band.fromMs);
	}

	function bandRange(band: TraceDurationBand): string {
		if (band.fromMs === null) return `under ${formatDurationMs(band.toMs ?? 0)}`;
		if (band.toMs === null) return `${formatDurationMs(band.fromMs)} and above`;
		return `${formatDurationMs(band.fromMs)} – ${formatDurationMs(band.toMs)}`;
	}

	function twoSignificant(ms: number): number {
		const step = 10 ** Math.max(0, Math.floor(Math.log10(ms)) - 1);
		return Math.round(ms / step) * step;
	}

	/** Visible band range: all-zero bands are trimmed off the ends of the axis, interior ones kept. */
	const visible = $derived.by<{ lo: number; hi: number } | null>(() => {
		if (!data) return null;
		let lo = data.bands.length;
		let hi = -1;
		for (const column of data.columns) {
			column.counts.forEach((count, i) => {
				if (count === 0) return;
				if (i < lo) lo = i;
				if (i > hi) hi = i;
			});
		}
		return hi === -1 ? null : { lo, hi };
	});

	const summary = $derived.by(() => {
		if (!data || !visible) return 'Span duration heatmap: no spans in this time range.';
		const from = formatChartTooltip(data.columns[0].timestamp);
		const to = formatChartTooltip(
			data.columns[data.columns.length - 1].timestamp + data.intervalSec
		);
		const perBand = data.bands.map((_, i) => data.columns.reduce((sum, c) => sum + c.counts[i], 0));
		const peak = data.bands[perBand.indexOf(Math.max(...perBand))];
		const total = perBand.reduce((sum, n) => sum + n, 0);
		return `Span duration heatmap, ${from} to ${to}: ${total} spans, most of them ${bandRange(peak)}.`;
	});

	let containerEl = $state<HTMLDivElement | null>(null);
	let chartEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(400);
	let chartHeight = $state(160);
	let chart: uPlotLib | null = null;
	let uPlotCtor: typeof uPlotLib | null = null;
	let chartBuildId = 0;

	let tooltipLeft = $state(0);
	let tooltipTop = $state(0);
	let hovered = $state<{ columnIndex: number; bandIndex: number } | null>(null);

	const tooltipText = $derived.by(() => {
		if (!data || !hovered) return null;
		const column = data.columns[hovered.columnIndex];
		const band = data.bands[hovered.bandIndex];
		if (!column || !band) return null;
		return {
			when: `${formatChartTooltip(column.timestamp)} – ${formatChartTooltip(column.timestamp + data.intervalSec)}`,
			band: bandRange(band),
			count: column.counts[hovered.bandIndex]
		};
	});

	/** Spreads bounds across the full ramp, so the palest and darkest ends stay in use. */
	function ramp(bounds: number[]): { lower: number; color: string }[] {
		const last = bounds.length - 1;
		return bounds.map((lower, i) => ({
			lower,
			color:
				last === 0
					? heatColors[Math.floor(heatColors.length / 2)]
					: heatColors[Math.round((i * (heatColors.length - 1)) / last)]
		}));
	}

	/**
	 * Colors go by rank, not magnitude: scaling against the maximum collapses to one flat shade as soon as
	 * volume is high or evenly spread. The cost is that a shade means different counts from query to query,
	 * so absolute numbers live only in the tooltip.
	 */
	const scale = $derived.by<{ lower: number; color: string }[]>(() => {
		if (!data || !visible) return [];
		const counts: number[] = [];
		for (const column of data.columns) {
			for (let b = visible.lo; b <= visible.hi; b++) {
				if (column.counts[b] > 0) counts.push(column.counts[b]);
			}
		}
		if (counts.length === 0) return [];
		counts.sort((a, b) => a - b);

		// Few enough levels to give each its own shade: quantile probes over a long run of ties keep landing
		// on the same count, which would paint a burst in the same shade as the cold cells.
		const steps = heatColors.length;
		const distinct = [...new Set(counts)];
		if (distinct.length <= steps) return ramp(distinct);

		const bounds = [
			...new Set(
				Array.from({ length: steps }, (_, i) => counts[Math.floor((i * counts.length) / steps)])
			)
		];
		// Ties can swallow every probe here too, so the top count keeps a step of its own.
		const max = counts[counts.length - 1];
		if (bounds.length < steps && max > bounds[bounds.length - 1]) bounds.push(max);

		return ramp(bounds);
	});

	let detachPointer: (() => void) | null = null;

	function destroyChart() {
		detachPointer?.();
		detachPointer = null;
		if (chart) {
			chart.destroy();
			chart = null;
		}
	}

	const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), max);

	async function buildChart() {
		if (!browser || !chartEl || !data || !visible) return;
		const buildId = ++chartBuildId;

		destroyChart();

		if (!uPlotCtor) {
			const mod = await import('uplot');
			uPlotCtor = mod.default;
		}
		if (!chartEl || !data || !visible || buildId !== chartBuildId) return;

		const UPlot = uPlotCtor;
		const grid = data;
		const { lo, hi } = visible;
		const steps = scale;
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);

		const timestamps = grid.columns.map((c) => c.timestamp);
		const span =
			timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : grid.intervalSec;
		const useDate = span > SECONDS_PER_DAY;

		const width = untrack(() => {
			const actual = containerEl?.clientWidth ?? 0;
			return actual > 0 ? actual : chartWidth;
		});
		const height = untrack(() => {
			const actual = containerEl?.clientHeight ?? 0;
			return actual > 0 ? actual : chartHeight;
		});

		function fillFor(count: number): string {
			let i = steps.length - 1;
			while (i > 0 && count < steps[i].lower) i--;
			return steps[i].color;
		}

		// A `draw` hook rather than series paths: the grid arrives aggregated, so uPlot is here for the
		// axes, cursor and resizing, not to plot points.
		function drawCells(u: uPlotLib) {
			const ctx = u.ctx;
			const originX = u.valToPos(timestamps[0], 'x', true);
			const cellWidth = u.valToPos(timestamps[0] + grid.intervalSec, 'x', true) - originX;
			const rowHeight = Math.abs(u.valToPos(1, 'y', true) - u.valToPos(0, 'y', true));

			ctx.save();
			ctx.beginPath();
			ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
			ctx.clip();

			for (const column of grid.columns) {
				const left = u.valToPos(column.timestamp, 'x', true);
				for (let b = lo; b <= hi; b++) {
					const count = column.counts[b];
					if (count === 0) continue;
					ctx.fillStyle = fillFor(count);
					ctx.fillRect(left, u.valToPos(b, 'y', true) - rowHeight / 2, cellWidth, rowHeight);
				}
			}

			ctx.restore();
		}

		const halfCell = grid.intervalSec / 2;
		const rowCount = hi - lo + 1;

		const spanSec = grid.intervalSec * (grid.columns.length + 1);
		const columnAt = (px: number, boxWidth: number): number =>
			((px / boxWidth) * spanSec - halfCell) / grid.intervalSec;
		const rowAt = (px: number, boxHeight: number): number => (px / boxHeight) * rowCount;

		const LADDER_STEP = 4;
		const interiorEdges = grid.bands.slice(1).map((band) => band.fromMs ?? 0);
		const bandEdges = [
			interiorEdges[0] / LADDER_STEP,
			...interiorEdges,
			interiorEdges[interiorEdges.length - 1] * LADDER_STEP
		];

		/** Duration at a fractional band position, log-linear inside a band to match the ×4 ladder. */
		const msAtBand = (position: number): number => {
			const index = clamp(Math.floor(position), grid.bands.length - 1);
			const from = bandEdges[index];
			return from * (bandEdges[index + 1] / from) ** (position - index);
		};

		const secondsAt = (px: number, boxWidth: number): number =>
			grid.columns[0].timestamp + columnAt(px, boxWidth) * grid.intervalSec;

		/**
		 * Hit-testing from the plot area's own box rather than uPlot's cursor: `cursor.idx` / `posToVal`
		 * made the reported cell disagree with the crosshair.
		 */
		function attachPointer(u: uPlotLib): () => void {
			const over = u.over;

			function onMove(event: PointerEvent) {
				const overRect = over.getBoundingClientRect();
				const containerRect = containerEl?.getBoundingClientRect();
				if (!containerRect || overRect.width <= 0 || overRect.height <= 0) return;

				const x = event.clientX - overRect.left;
				const y = event.clientY - overRect.top;

				const rowFromTop = Math.floor(rowAt(y, overRect.height));
				const columnIndex = Math.floor(columnAt(x, overRect.width));

				if (
					rowFromTop < 0 ||
					rowFromTop >= rowCount ||
					columnIndex < 0 ||
					columnIndex >= grid.columns.length
				) {
					hovered = null;
					return;
				}

				const bandIndex = hi - rowFromTop;
				// Most moves land on the cell already reported; reassigning would re-run the tooltip's date
				// formatting for an identical string.
				if (hovered?.columnIndex !== columnIndex || hovered.bandIndex !== bandIndex) {
					hovered = { columnIndex, bandIndex };
				}

				const cursorAbsLeft = overRect.left - containerRect.left + x;
				tooltipLeft =
					cursorAbsLeft + TOOLTIP_WIDTH + TOOLTIP_GAP_RIGHT > containerRect.width
						? cursorAbsLeft - TOOLTIP_WIDTH - TOOLTIP_GAP_LEFT
						: cursorAbsLeft + TOOLTIP_GAP_RIGHT;
				tooltipTop = overRect.top - containerRect.top + y - TOOLTIP_VERTICAL_NUDGE;
			}

			function onLeave() {
				hovered = null;
			}

			over.addEventListener('pointermove', onMove);
			over.addEventListener('pointerleave', onLeave);
			return () => {
				over.removeEventListener('pointermove', onMove);
				over.removeEventListener('pointerleave', onLeave);
			};
		}

		function onSelect(u: uPlotLib): void {
			const { left, top, width: selWidth, height: selHeight } = u.select;
			const plotWidth = u.over.clientWidth;
			const plotHeight = u.over.clientHeight;
			u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);

			if (loading) return;
			if (plotWidth <= 0 || plotHeight <= 0) return;

			const thinX = selWidth < 4;
			const thinY = selHeight < 4;
			if (thinX && thinY) return;

			const timeUntouched = thinX || (left <= 0 && left + selWidth >= plotWidth);
			const durationUntouched = thinY || (top <= 0 && top + selHeight >= plotHeight);
			if (timeUntouched && durationUntouched) return;

			let time: TraceHeatmapBrush['time'] = null;
			if (!timeUntouched) {
				const spanStart = grid.columns[0].timestamp;
				const spanEnd = grid.columns[grid.columns.length - 1].timestamp + grid.intervalSec;
				const clampTs = (ts: number): number => Math.min(Math.max(ts, spanStart), spanEnd);
				const startTs = clampTs(Math.floor(secondsAt(left, plotWidth)));
				const endTs = clampTs(Math.ceil(secondsAt(left + selWidth, plotWidth)));
				time = { startTs, endTs: endTs > startTs ? endTs : startTs + 1 };
			}

			let duration: TraceHeatmapBrush['duration'] = null;
			if (!durationUntouched) {
				const fromRaw = msAtBand(lo + rowCount - rowAt(top + selHeight, plotHeight));
				const toRaw = msAtBand(lo + rowCount - rowAt(top, plotHeight));
				const fromMs = fromRaw < 1 ? null : twoSignificant(fromRaw);
				const openTop = top <= 0 && hi === grid.bands.length - 1;
				const toRounded = openTop ? null : twoSignificant(toRaw);
				const toMs =
					fromMs !== null && toRounded !== null && toRounded <= fromMs ? fromMs + 1 : toRounded;
				duration = fromMs === null && toMs === null ? null : { fromMs, toMs };
			}

			if (time === null && duration === null) return;
			onBrush({ time, duration });
		}

		const opts: uPlotLib.Options = {
			width,
			height,
			// uPlot needs a series per data array; this one is never drawn.
			series: [{ label: 'Time' }, { label: 'Spans', show: false }],
			cursor: {
				drag: { x: true, y: true, dist: 4, setScale: false },
				points: { show: false }
			},
			select: { show: true, left: 0, top: 0, width: 0, height: 0 },
			legend: { show: false },
			hooks: { draw: [drawCells], setSelect: [onSelect] },
			scales: {
				x: {
					time: true,
					// Columns are bucket starts, so the last one needs a full cell of room to its right.
					range: (_u, min, max) => [min - halfCell, max + grid.intervalSec + halfCell]
				},
				y: { range: () => [lo - 0.5, hi + 0.5] }
			},
			axes: [
				{
					stroke: axisStroke,
					grid: { show: false },
					ticks: { show: false },
					gap: 2,
					size: 20,
					space: 120,
					values: (_u, splits) =>
						splits.map((v) => (useDate ? formatChartDate(v) : formatChartTime(v)))
				},
				{
					stroke: axisStroke,
					grid: { show: true, stroke: gridStroke, width: 0.8 },
					ticks: { show: false },
					size: Y_AXIS_SIZE,
					splits: () => Array.from({ length: rowCount }, (_, i) => lo + i),
					values: (_u, splits) => splits.map((v) => bandLabel(grid.bands[v]))
				}
			]
		};

		chart = new UPlot(opts, [timestamps, grid.columns.map((c) => c.docCount)], chartEl);
		detachPointer = attachPointer(chart);
	}

	$effect(() => {
		if (!browser || !containerEl) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				if (width > 0 && Math.abs(width - chartWidth) > 1) chartWidth = width;
				if (height > 0 && Math.abs(height - chartHeight) > 1) chartHeight = height;
			}
		});
		observer.observe(containerEl);
		return () => observer.disconnect();
	});

	$effect(() => {
		// `scale` is read after an await inside `buildChart`, too late to register as a dependency.
		void scale;

		// The pointer hasn't moved, but its old indices now address a different bucket.
		hovered = null;

		if (browser && data && visible && chartEl) {
			void buildChart();
		} else {
			destroyChart();
		}

		return () => destroyChart();
	});

	$effect(() => {
		if (chart && chartWidth > 0 && chartHeight > 0) {
			chart.setSize({ width: chartWidth, height: chartHeight });
		}
	});
</script>

{#if error !== null}
	<div class="flex h-full items-center justify-center p-4">
		<PanelError message={error} {retry} />
	</div>
{:else if data === null}
	<div class="flex h-full items-center justify-center" aria-busy="true">
		<span class="loading loading-spinner loading-sm"></span>
	</div>
{:else if visible === null}
	<div class="flex h-full items-center justify-center" role="status">
		<p class="text-base-content/60 text-xs">No spans in this time range</p>
	</div>
{:else}
	<div
		bind:this={containerEl}
		class="trace-heatmap relative h-full w-full transition-opacity"
		class:opacity-50={loading}
		aria-busy={loading}
		role="img"
		aria-label={summary}
	>
		<div bind:this={chartEl}></div>

		{#if tooltipText}
			<div
				class="border-line bg-base-100 pointer-events-none absolute z-10 rounded border p-2 text-xs shadow-lg"
				style="left: {tooltipLeft}px; top: {tooltipTop}px; width: {TOOLTIP_WIDTH}px;"
			>
				<p class="text-base-content/60 font-mono text-[10px]">{tooltipText.when}</p>
				<p class="mt-1">{tooltipText.band}</p>
				<p class="text-base-content/60">
					{pluralize(tooltipText.count, 'span')}
				</p>
			</div>
		{/if}
	</div>
{/if}
