<script lang="ts">
	import { get } from 'svelte/store';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import LogHeader from './LogHeader.svelte';
	import LogRow from './LogRow.svelte';
	import InlineLogRow from './InlineLogRow.svelte';
	import type { FieldConfig, LogHit, SortDirection } from '$lib/types';
	import type { DisplayMode } from 'api/types';

	const ROW_ESTIMATE = 25;
	const OVERSCAN = 8;

	let {
		logs,
		activeFields,
		gridTemplate,
		fieldConfig,
		sortDirection,
		viewport,
		lineWrap = false,
		displayMode = 'table',
		listEnd = 'more',
		onToggleSort = () => {},
		onRowClick = () => {}
	}: {
		logs: LogHit[];
		activeFields: string[];
		gridTemplate: string;
		fieldConfig: FieldConfig | null;
		sortDirection: SortDirection;
		viewport: HTMLElement | null;
		lineWrap?: boolean;
		displayMode?: DisplayMode;
		listEnd?: 'more' | 'end' | 'capped';
		onToggleSort?: () => void;
		onRowClick?: (hit: LogHit) => void;
	} = $props();

	let headerEl = $state<HTMLElement | null>(null);
	let scrollMargin = $state(0);

	const virtualizer = createVirtualizer<HTMLElement, HTMLElement>({
		count: logs.length,
		getScrollElement: () => viewport,
		estimateSize: () => ROW_ESTIMATE,
		overscan: OVERSCAN,
		scrollMargin: 0
	});

	const messageField = $derived(fieldConfig?.messageField);

	function measure(node: HTMLElement) {
		get(virtualizer).measureElement(node);
	}

	$effect(() => {
		const el = headerEl;
		if (el === null) {
			scrollMargin = 0;
			return;
		}
		const ro = new ResizeObserver(() => (scrollMargin = el.offsetHeight));
		ro.observe(el);
		return () => ro.disconnect();
	});

	$effect(() => {
		const count = logs.length;
		const margin = scrollMargin;
		const el = viewport;
		const v = get(virtualizer);
		v.setOptions({
			count,
			scrollMargin: margin,
			getScrollElement: () => el,
			estimateSize: () => ROW_ESTIMATE
		});
	});
</script>

<div class="w-fit min-w-full">
	{#if displayMode === 'table'}
		<LogHeader
			bind:el={headerEl}
			{fieldConfig}
			columns={activeFields}
			{gridTemplate}
			{sortDirection}
			{lineWrap}
			{onToggleSort}
		/>
	{/if}
	<div class="relative w-full" style="height: {$virtualizer.getTotalSize()}px;">
		{#each $virtualizer.getVirtualItems() as item (logs[item.index]?.key ?? item.index)}
			{#if logs[item.index]}
				<div
					use:measure
					data-index={item.index}
					class="absolute top-0 left-0 w-full"
					style="transform: translateY({item.start - scrollMargin}px);"
				>
					{#if displayMode === 'inline'}
						<InlineLogRow
							hit={logs[item.index]}
							columns={activeFields}
							{lineWrap}
							onActivate={() => onRowClick(logs[item.index])}
						/>
					{:else}
						<LogRow
							hit={logs[item.index]}
							columns={activeFields}
							{gridTemplate}
							{messageField}
							{lineWrap}
							onActivate={() => onRowClick(logs[item.index])}
						/>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
	{#if listEnd !== 'more'}
		<div
			class="border-line text-base-content/40 sticky left-0 w-fit border-t px-3 py-4 text-[11px]"
		>
			{#if listEnd === 'capped'}
				Showing the first 10,000 logs. Narrow the time range to see the rest.
			{:else}
				End of results
			{/if}
		</div>
	{/if}
</div>
