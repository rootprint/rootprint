<script lang="ts">
	import { get } from 'svelte/store';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import LogHeader from './LogHeader.svelte';
	import LogRow from './LogRow.svelte';
	import type { FieldConfig, LogHit, SortDirection, TimezoneMode } from '$lib/types';

	// Uniform row height: text-xs line (16px) + py-1 (8px) + 1px border-b.
	const ROW_HEIGHT = 25;
	const OVERSCAN = 8;

	let {
		logs,
		activeFields,
		gridTemplate,
		timezoneMode,
		fieldConfig,
		sortDirection,
		viewport,
		ontogglesort = () => {},
		onRowClick = () => {}
	}: {
		logs: LogHit[];
		activeFields: string[];
		gridTemplate: string;
		timezoneMode: TimezoneMode;
		fieldConfig: FieldConfig | null;
		sortDirection: SortDirection;
		viewport: HTMLElement | null;
		ontogglesort?: () => void;
		onRowClick?: (hit: LogHit) => void;
	} = $props();

	let headerEl = $state<HTMLElement | null>(null);
	let scrollMargin = $state(0);

	const virtualizer = createVirtualizer<HTMLElement, HTMLElement>({
		count: logs.length,
		getScrollElement: () => viewport,
		estimateSize: () => ROW_HEIGHT,
		overscan: OVERSCAN,
		scrollMargin: 0
	});

	$effect(() => {
		scrollMargin = headerEl?.offsetHeight ?? 0;
	});

	$effect(() => {
		const count = logs.length;
		const margin = scrollMargin;
		const el = viewport;
		const v = get(virtualizer);
		v.setOptions({ count, scrollMargin: margin, getScrollElement: () => el });
		v.measure();
	});
</script>

<div class="w-fit min-w-full">
	<LogHeader
		bind:el={headerEl}
		{fieldConfig}
		columns={activeFields}
		{gridTemplate}
		{sortDirection}
		{ontogglesort}
	/>
	<div class="relative w-full" style="height: {$virtualizer.getTotalSize()}px;">
		{#each $virtualizer.getVirtualItems() as item (logs[item.index]?.key ?? item.index)}
			{#if logs[item.index]}
				<div
					class="absolute top-0 left-0 w-full"
					style="height: {item.size}px; transform: translateY({item.start - scrollMargin}px);"
				>
					<LogRow
						hit={logs[item.index]}
						columns={activeFields}
						{gridTemplate}
						{timezoneMode}
						onclick={() => onRowClick(logs[item.index])}
					/>
				</div>
			{/if}
		{/each}
	</div>
</div>
