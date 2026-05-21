<script lang="ts">
  import type uPlotLib from 'uplot';
  import 'uplot/dist/uPlot.min.css';

  import { browser } from '$app/environment';
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  import type { HistogramBucket, TimezoneMode } from '$lib/types';
  import { baseContentAt, getLevelColor, sortBySeverity } from '$lib/utils/log-helpers';
  import {
    formatChartDate,
    formatChartTime,
    formatChartTooltip
  } from '$lib/utils/time';

  type Props = {
    buckets: HistogramBucket[];
    loading: boolean;
    error: string | null;
    numHits: number;
    timezoneMode: TimezoneMode;
    collapsed: boolean;
    onbrush: (startTs: number, endTs: number) => void;
  };

  let {
    buckets,
    loading,
    error,
    numHits,
    timezoneMode,
    collapsed = $bindable(false),
    onbrush
  }: Props = $props();

  const SECONDS_PER_DAY = 86400;

  let containerEl = $state<HTMLDivElement | null>(null);
  let chartEl = $state<HTMLDivElement | null>(null);
  let chartWidth = $state(400);
  let chart: uPlotLib | null = null;
  let uPlotCtor: typeof uPlotLib | null = null;
  let chartBuildId = 0;

  let tooltipVisible = $state(false);
  let tooltipLeft = $state(0);
  let tooltipTop = $state(0);
  let tooltipIdx = $state<number | null>(null);

  const TOOLTIP_WIDTH = 180;
  const TOOLTIP_GAP_RIGHT = 12;
  const TOOLTIP_GAP_LEFT = 8;
  const TOOLTIP_VERTICAL_NUDGE = 10;

  let bucketWidthLabel = $derived.by<string | null>(() => {
    if (buckets.length < 2) return null;
    const secs = buckets[1].timestamp - buckets[0].timestamp;
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.round(secs / 60)}m`;
    if (secs < SECONDS_PER_DAY) return `${Math.round(secs / 3600)}h`;
    return `${Math.round(secs / SECONDS_PER_DAY)}d`;
  });

  let levels = $derived.by<string[]>(() => {
    const seen = new Set<string>();
    for (const b of buckets) {
      for (const k of Object.keys(b.levels)) {
        seen.add(k.toUpperCase());
      }
    }
    if (seen.size === 0 && buckets.length > 0) return ['UNKNOWN'];
    return sortBySeverity([...seen]);
  });

  let levelColors = $derived.by<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const level of levels) map[level] = getLevelColor(level);
    return map;
  });

  let columnarData = $derived.by(() => {
    if (buckets.length === 0) return null;

    const timestamps: number[] = buckets.map((b) => b.timestamp);

    const upperBuckets: Record<string, number>[] = buckets.map((b) => {
      const out: Record<string, number> = {};
      for (const k of Object.keys(b.levels)) out[k.toUpperCase()] = b.levels[k];
      return out;
    });

    const isSyntheticUnknown = levels.length === 1 && levels[0] === 'UNKNOWN';

    const rawSeries: number[][] = isSyntheticUnknown
      ? [buckets.map((b) => b.count)]
      : levels.map((level) => upperBuckets.map((u) => u[level] ?? 0));

    const stackedSeries: number[][] = [];
    for (let i = 0; i < rawSeries.length; i++) {
      const stacked = Array.from<number>({ length: timestamps.length });
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

  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  async function buildChart() {
    if (!browser || !chartEl || collapsed || !columnarData) return;
    const buildId = ++chartBuildId;

    if (containerEl) {
      const actualWidth = containerEl.clientWidth;
      if (actualWidth > 0) chartWidth = actualWidth;
    }

    destroyChart();

    if (!uPlotCtor) {
      const mod = await import('uplot');
      uPlotCtor = mod.default;
    }
    if (!chartEl || collapsed || !columnarData || buildId !== chartBuildId) return;

    const UPlot = uPlotCtor;
    const barPaths =
      UPlot.paths.bars?.({ size: [0.96, 64, 1], align: 0, gap: 1 }) ?? undefined;

    const series: uPlotLib.Series[] = [{ label: 'Time' }];
    const bands: uPlotLib.Band[] = [];

    for (let i = 0; i < levels.length; i++) {
      const color = levelColors[levels[i]];
      series.push({
        label: levels[i],
        fill: color,
        stroke: color,
        width: 0,
        paths: barPaths,
        points: { show: false }
      });
      if (i > 0) {
        bands.push({
          series: [i + 1, i] as [number, number],
          fill: color
        });
      }
    }

    const timestamps = columnarData.uplot[0];
    const span =
      timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
    const useDate = span > SECONDS_PER_DAY;
    const bucketWidth = timestamps.length > 1 ? timestamps[1] - timestamps[0] : 1;
    const halfBucket = bucketWidth / 2;

    const axisStroke = baseContentAt(0.45);
    const gridStroke = baseContentAt(0.1);

    const opts: uPlotLib.Options = {
      width: chartWidth,
      height: 150,
      series,
      bands,
      cursor: {
        drag: { x: true, y: false, setScale: false }
      },
      select: { show: true, left: 0, top: 0, width: 0, height: 0 },
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

            const over = u.over;
            const left = u.cursor.left ?? 0;
            const top = u.cursor.top ?? 0;
            const overRect = over.getBoundingClientRect();
            const containerRect = containerEl?.getBoundingClientRect();
            if (!containerRect) return;

            const offsetLeft = overRect.left - containerRect.left;
            const offsetTop = overRect.top - containerRect.top;
            const cursorAbsLeft = offsetLeft + left;

            if (cursorAbsLeft + TOOLTIP_WIDTH + TOOLTIP_GAP_RIGHT > containerRect.width) {
              tooltipLeft = cursorAbsLeft - TOOLTIP_WIDTH - TOOLTIP_GAP_LEFT;
            } else {
              tooltipLeft = cursorAbsLeft + TOOLTIP_GAP_RIGHT;
            }
            tooltipTop = offsetTop + top - TOOLTIP_VERTICAL_NUDGE;
            tooltipVisible = true;
          }
        ]
      },
      legend: { show: false },
      scales: {
        x: {
          time: true,
          range: (_u, min, max) => [min - halfBucket, max + halfBucket]
        },
        y: {
          range: (_u, _min, max) => [0, max || 1]
        }
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
            splits.map((v) =>
              useDate
                ? formatChartDate(v, timezoneMode)
                : formatChartTime(v, timezoneMode)
            )
        },
        {
          stroke: axisStroke,
          grid: { show: true, stroke: gridStroke, width: 0.8 },
          ticks: { show: false },
          size: 50
        }
      ]
    };

    chart = new UPlot(opts, columnarData.uplot, chartEl);
  }

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
    void columnarData;
    void timezoneMode;
    void collapsed;

    if (browser && !collapsed && columnarData && chartEl) {
      buildChart();
    } else if (collapsed) {
      destroyChart();
    }

    return () => destroyChart();
  });

  $effect(() => {
    if (chart && chartWidth > 0) {
      chart.setSize({ width: chartWidth, height: 150 });
    }
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

<div class="border-b border-base-content/10">
  <div class="flex items-center px-3 py-1.5">
    <button
      class="flex flex-1 items-center gap-1.5"
      onclick={() => (collapsed = !collapsed)}
    >
      {#if collapsed}
        <ChevronRight size={10} class="text-base-content/40" />
      {:else}
        <ChevronDown size={10} class="text-base-content/40" />
      {/if}
      <span
        class="text-left font-mono text-[14px] uppercase tracking-wider text-base-content/50"
      >
        Frequency
      </span>
    </button>
    <div
      class="flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-base-content/50"
    >
      {#if loading}
        <span class="loading loading-xs loading-spinner mr-1"></span>
      {/if}
      {#if bucketWidthLabel}
        <span class="text-base-content/80">{bucketWidthLabel}</span>
        <span>buckets</span>
        <span class="text-base-content/30">·</span>
      {/if}
      <span class="text-base-content/80">{numHits.toLocaleString()}</span>
      <span>hits</span>
    </div>
  </div>

  {#if !collapsed}
    <div transition:slide={{ duration: 200 }}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={containerEl}
        class="relative px-2 pb-2"
        onmouseleave={() => {
          tooltipVisible = false;
          tooltipIdx = null;
        }}
      >
        {#if error}
          <div class="flex h-[150px] items-center justify-center">
            <p class="font-mono text-xs text-error/80">{error}</p>
          </div>
        {:else if loading && buckets.length === 0}
          <div class="flex h-[150px] items-center justify-center">
            <span
              class="loading loading-sm loading-spinner"
              aria-label="Loading frequency chart"
            ></span>
          </div>
        {:else if buckets.length === 0}
          <div class="flex h-[150px] flex-col items-center justify-center gap-1">
            <p
              class="font-mono text-[10px] uppercase tracking-wider text-base-content/50"
            >
              No frequency data
            </p>
            <p class="font-mono text-xs text-base-content/40">
              Try adjusting your time range or query filters
            </p>
          </div>
        {:else}
          <div bind:this={chartEl}></div>
        {/if}
        {#if tooltipVisible && tooltipIdx != null && columnarData}
          <div
            class="hairline pointer-events-none absolute z-20 rounded bg-base-100 px-2.5 py-1.5"
            style="left: {tooltipLeft}px; top: {tooltipTop}px;"
          >
            <div class="mb-1 font-mono text-[11px] text-base-content/60">
              {formatChartTooltip(columnarData.uplot[0][tooltipIdx], timezoneMode)}
            </div>
            {#each levels as level, i (level)}
              {@const count = columnarData.rawSeries[i][tooltipIdx]}
              {#if count > 0}
                <div class="flex items-center gap-1.5 text-xs">
                  <span
                    class="inline-block h-2 w-2 rounded-sm"
                    style="background-color: {levelColors[level]}"
                  ></span>
                  <span class="text-base-content/80">{level}</span>
                  <span class="ml-auto font-mono text-base-content"
                    >{count.toLocaleString()}</span
                  >
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
