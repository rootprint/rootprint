<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';
	import ChartStyle from './chart-style.svelte';
	import { setChartContext, type ChartConfig } from './chart-utils.js';

	const uid = $props.id();

	let {
		ref = $bindable(null),
		id = uid,
		class: className,
		children,
		config,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		config: ChartConfig;
	} = $props();

	const chartId = $derived(`chart-${id || uid.replace(/:/g, '')}`);

	setChartContext({
		get config() {
			return config;
		}
	});
</script>

<div
	bind:this={ref}
	data-chart={chartId}
	data-slot="chart"
	class={cn(
		'flex aspect-video justify-center overflow-visible text-xs',
		'[&_.lc-highlight-point]:stroke-transparent',
		'[&_.lc-line]:stroke-border/50',

		// hide layerchart's hover intersection line
		'[&_.lc-highlight-line]:stroke-0',

		// keep other series at full opacity when hovering a point on a stacked chart
		'[&_.lc-area-path]:opacity-100 [&_.lc-highlight-line]:opacity-100 [&_.lc-highlight-point]:opacity-100 [&_.lc-spline-path]:opacity-100 [&_.lc-text]:text-xs [&_.lc-text-svg]:overflow-visible',

		// drop tick lines globally instead of disabling tickMarks per-chart
		'[&_.lc-axis-tick]:stroke-0',

		// hide axis rule; the grid line already covers it and the rule overlaps marks (rendered after)
		'[&_.lc-rule-x-line:not(.lc-grid-x-rule)]:stroke-0 [&_.lc-rule-y-line:not(.lc-grid-y-rule)]:stroke-0',
		'[&_.lc-grid-x-radial-line]:stroke-border [&_.lc-grid-x-radial-circle]:stroke-border',
		'[&_.lc-grid-y-radial-line]:stroke-border [&_.lc-grid-y-radial-circle]:stroke-border',

		'[&_.lc-legend-swatch-button]:items-center [&_.lc-legend-swatch-button]:gap-1.5',
		'[&_.lc-legend-swatch-group]:items-center [&_.lc-legend-swatch-group]:gap-4',
		'[&_.lc-legend-swatch]:size-2.5 [&_.lc-legend-swatch]:rounded-[2px]',

		'[&_.lc-labels-text:not([fill])]:fill-foreground [&_text]:stroke-transparent',

		'[&_.lc-axis-tick-label]:fill-muted-foreground [&_.lc-axis-tick-label]:font-normal',
		'[&_.lc-tooltip-rects-g]:fill-transparent',
		'[&_.lc-layout-svg-g]:fill-transparent',
		'[&_.lc-root-container]:w-full',
		className
	)}
	{...restProps}
>
	<ChartStyle id={chartId} {config} />
	{@render children?.()}
</div>
