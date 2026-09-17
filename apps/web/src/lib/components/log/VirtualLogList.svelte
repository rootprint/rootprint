<script lang="ts">
	import { get } from 'svelte/store';
	import { createVirtualizer } from '@tanstack/svelte-virtual';
	import LogHeader from './LogHeader.svelte';
	import LogRow from './LogRow.svelte';
	import InlineLogRow from './InlineLogRow.svelte';
	import type { FieldConfig, LogHit, SortDirection } from '$lib/types';
	import type { LogListRow } from '$lib/utils/fold-hits';
	import type { DisplayMode } from 'api/types';

	const ROW_ESTIMATE = 25;
	const OVERSCAN = 8;

	let {
		rows,
		activeFields,
		gridTemplate,
		fieldConfig,
		sortDirection,
		viewport,
		lineWrap = false,
		displayMode = 'table',
		foldGutter = false,
		listEnd = 'more',
		loadingMore = false,
		onToggleSort = () => {},
		onRowClick = () => {},
		onToggleFold = () => {},
		onLoadMore = () => {}
	}: {
		rows: LogListRow[];
		activeFields: string[];
		gridTemplate: string;
		fieldConfig: FieldConfig | null;
		sortDirection: SortDirection;
		viewport: HTMLElement | null;
		lineWrap?: boolean;
		displayMode?: DisplayMode;
		foldGutter?: boolean;
		listEnd?: 'more' | 'end' | 'capped';
		loadingMore?: boolean;
		onToggleSort?: () => void;
		onRowClick?: (hit: LogHit) => void;
		onToggleFold?: (id: string) => void;
		onLoadMore?: () => void;
	} = $props();

	let headerEl = $state<HTMLElement | null>(null);
	let scrollMargin = $state(0);

	const virtualizer = createVirtualizer<HTMLElement, HTMLElement>({
		count: rows.length,
		getScrollElement: () => viewport,
		estimateSize: () => ROW_ESTIMATE,
		getItemKey: (index) => rowKey(rows[index], index),
		overscan: OVERSCAN,
		scrollMargin: 0
	});

	const messageField = $derived(fieldConfig?.messageField);
	const foldGutterWidth = $derived.by(() => {
		let digits = 1;
		for (const row of rows) {
			if (row.kind === 'fold') digits = Math.max(digits, String(row.count).length);
		}
		return `calc(${digits}ch + 1.5rem)`;
	});

	function measure(node: HTMLElement) {
		get(virtualizer).measureElement(node);
	}

	function rowKey(row: LogListRow | undefined, index: number): string {
		if (!row) return String(index);
		return row.kind === 'fold' ? `fold:${row.id}` : `hit:${row.hit.key}`;
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

	$effect.pre(() => {
		const currentRows = rows;
		const margin = scrollMargin;
		const el = viewport;
		const v = get(virtualizer);
		v.setOptions({
			count: currentRows.length,
			scrollMargin: margin,
			getScrollElement: () => el,
			estimateSize: () => ROW_ESTIMATE,
			getItemKey: (index) => rowKey(currentRows[index], index),
			overscan: OVERSCAN
		});
	});
</script>

<div class="w-fit min-w-full" style="--fold-gutter-width: {foldGutterWidth};">
	{#if displayMode === 'table'}
		<LogHeader
			bind:el={headerEl}
			{fieldConfig}
			columns={activeFields}
			{gridTemplate}
			{sortDirection}
			{lineWrap}
			{foldGutter}
			{onToggleSort}
		/>
	{/if}
	<div class="relative w-full" style="height: {$virtualizer.getTotalSize()}px;">
		{#each $virtualizer.getVirtualItems() as item (rowKey(rows[item.index], item.index))}
			{#if rows[item.index]}
				{@const row = rows[item.index]}
				{@const fold = row.kind === 'fold' ? row : null}
				{@const foldChild = row.kind === 'hit' && row.foldChild === true}
				{@const toggleFold = () => fold && onToggleFold(fold.id)}
				<div
					{@attach measure}
					data-index={item.index}
					class="absolute top-0 left-0 w-full"
					style="transform: translateY({item.start - scrollMargin}px);"
				>
					{#if displayMode === 'inline'}
						<InlineLogRow
							hit={row.hit}
							columns={activeFields}
							{lineWrap}
							{foldChild}
							{fold}
							onActivate={() => onRowClick(row.hit)}
							onToggleFold={toggleFold}
						/>
					{:else}
						<LogRow
							hit={row.hit}
							columns={activeFields}
							{gridTemplate}
							{messageField}
							{lineWrap}
							{foldGutter}
							{foldChild}
							{fold}
							onActivate={() => onRowClick(row.hit)}
							onToggleFold={toggleFold}
						/>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
	{#if listEnd === 'more'}
		<div class="border-line sticky left-0 w-fit border-t px-3 py-3">
			<button
				type="button"
				class="btn btn-ghost btn-xs"
				disabled={loadingMore}
				onclick={onLoadMore}
			>
				{#if loadingMore}
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					Loading more
				{:else}
					Load more
				{/if}
			</button>
		</div>
	{:else}
		<div class="border-line text-muted sticky left-0 w-fit border-t px-3 py-4 text-xs">
			{#if listEnd === 'capped'}
				Showing the first 10,000 logs. Narrow the time range to see the rest.
			{:else}
				End of results
			{/if}
		</div>
	{/if}
</div>
