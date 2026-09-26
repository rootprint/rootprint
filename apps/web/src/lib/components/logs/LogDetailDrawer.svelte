<script lang="ts">
	import { ExternalLink, GripVertical, RotateCw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { page } from '$app/state';

	import DrawerHeader, { type DrawerTab } from './drawer/DrawerHeader.svelte';
	import ContextPane from './drawer/ContextPane.svelte';
	import JsonPane from './drawer/JsonPane.svelte';
	import ParametersPane from './drawer/ParametersPane.svelte';
	import TracebackPane from './drawer/TracebackPane.svelte';
	import SpanDetailPane from '$lib/components/traces/SpanDetailPane.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import TracePane from '$lib/components/traces/TracePane.svelte';
	import { buildTraceModel } from '$lib/components/traces/trace-model';
	import { fetchTrace } from '$lib/api/traces';
	import { createShare } from '$lib/api/shares';
	import { ApiError } from '$lib/api/errors';
	import { getByPath } from '$lib/components/logs/get-by-path';
	import { readString, removeKey, writeString } from '$lib/utils/safe-storage';
	import { traceDetailHref } from '$lib/utils/trace-params';
	import { isTraceId } from 'api/schemas';
	import type { LogHit, TraceModel } from '$lib/types';
	import type { SearchStore } from '$lib/components/logs/search.svelte';

	const MAX_SHARE_PAYLOAD_BYTES = 64 * 1024;

	const DRAWER_WIDTH_KEY = 'rootprint:drawer-width';
	const MIN_DRAWER_WIDTH = 400;
	const MAX_DRAWER_WIDTH_FRACTION = 0.9;
	const DEFAULT_DRAWER_FRACTION = 0.5;

	function clampWidth(px: number, viewport: number): number {
		// Never let the floor exceed the viewport itself — on narrow windows the
		// drawer would otherwise overflow and break the ARIA range invariant.
		const min = Math.min(MIN_DRAWER_WIDTH, viewport);
		const max = Math.max(min, Math.floor(viewport * MAX_DRAWER_WIDTH_FRACTION));
		return Math.min(max, Math.max(min, Math.round(px)));
	}

	function readStoredWidth(): number | null {
		const raw = readString(DRAWER_WIDTH_KEY);
		if (raw === null) return null;
		const parsed = Number(raw);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
	}

	function persistWidth(px: number): void {
		writeString(DRAWER_WIDTH_KEY, String(px));
	}

	let {
		hit,
		onClose,
		onReplaceHit,
		store
	}: {
		hit: LogHit | null;
		onClose: () => void;
		onReplaceHit: (hit: LogHit) => void;
		store: SearchStore;
	} = $props();

	let activeTab = $state<DrawerTab>('parameters');

	const traceback = $derived.by((): unknown => {
		const path = store.fieldConfig?.tracebackField;
		if (!path || !hit) return undefined;
		return getByPath(hit.raw, path);
	});
	const hasTraceback = $derived(traceback != null && traceback !== '');
	const traceId = $derived.by((): string | null => {
		const path = store.fieldConfig?.traceIdField;
		if (!path || !hit) return null;
		const v = getByPath(hit.raw, path);
		const id = typeof v === 'string' ? v.toLowerCase() : v;
		return isTraceId(id) ? id : null;
	});
	let selectedSpanId = $state<string | null>(null);
	let traceLoad = $state.raw<{ traceId: string; model: Promise<TraceModel> } | null>(null);

	function loadTrace(id: string): void {
		const model = fetchTrace(id).then(buildTraceModel);
		// A superseded load is no longer awaited, so its rejection would go unhandled.
		model.catch(() => {});
		traceLoad = { traceId: id, model };
	}

	// Only once the tab opens: each fetch is a span search plus an audit row.
	$effect(() => {
		if (activeTab === 'trace' && traceId !== null && traceLoad?.traceId !== traceId) {
			loadTrace(traceId);
		}
	});

	let dialogRef: HTMLDivElement | null = $state(null);
	let previousFocus: HTMLElement | null = null;

	let widthPx = $state<number>(0);
	let viewportWidth = $state<number>(0);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartWidth = 0;

	$effect(() => {
		const vw = window.innerWidth;
		viewportWidth = vw;
		const stored = readStoredWidth();
		widthPx =
			stored !== null ? clampWidth(stored, vw) : clampWidth(vw * DEFAULT_DRAWER_FRACTION, vw);

		function onResize(): void {
			viewportWidth = window.innerWidth;
			widthPx = clampWidth(widthPx, viewportWidth);
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	// Body decoration follows `dragging` reactively so it can't leak if pointerup/
	// pointercancel is missed (devtools, alt-tab, drag-outside-window).
	$effect(() => {
		if (!dragging) return;
		document.body.classList.add('select-none', 'cursor-ew-resize');
		return () => {
			document.body.classList.remove('select-none', 'cursor-ew-resize');
		};
	});

	$effect(() => {
		if (!hit) return;
		const alreadyLocked = document.body.classList.contains('overflow-hidden');
		document.body.classList.add('overflow-hidden');
		return () => {
			if (!alreadyLocked) document.body.classList.remove('overflow-hidden');
		};
	});

	let prevHit: LogHit | null = null;
	$effect(() => {
		const opened = hit !== null && prevHit === null;
		prevHit = hit;
		if (!opened) return;
		activeTab = 'parameters';
		selectedSpanId = null;
		previousFocus = document.activeElement as HTMLElement | null;
		queueMicrotask(() => dialogRef?.focus());
	});

	$effect(() => {
		if (activeTab === 'trace' && traceId === null) activeTab = 'parameters';
		else if (activeTab === 'traceback' && !hasTraceback) activeTab = 'parameters';
	});

	function close() {
		onClose();
		queueMicrotask(() => previousFocus?.focus());
	}

	function closeSpan(): void {
		const closed = selectedSpanId;
		selectedSpanId = null;
		if (closed) queueMicrotask(() => document.getElementById(`span-btn-${closed}`)?.focus());
	}

	const focusOnCreate = (node: HTMLElement) => node.focus();

	function handleKeydown(e: KeyboardEvent) {
		if (!hit || e.key !== 'Escape') return;
		e.preventDefault();
		if (selectedSpanId !== null) closeSpan();
		else close();
	}

	async function shareLog(): Promise<string | undefined> {
		if (!hit || !store.fieldConfig) return;
		const indexId = store.selectedIndex;
		const startTime = store.resolvedStartTs;
		const endTime = store.resolvedEndTs;
		if (indexId === null || startTime === undefined || endTime === undefined) {
			toast.error('Search context not ready');
			return;
		}
		const sharePayload = {
			indexId,
			query: store.query,
			startTime,
			endTime,
			hit: hit.raw,
			filters: store.filters
		};
		const payloadSize = new TextEncoder().encode(JSON.stringify(sharePayload)).byteLength;
		if (payloadSize > MAX_SHARE_PAYLOAD_BYTES) {
			toast.error('Share payload too large');
			return;
		}
		try {
			const { code } = await createShare(sharePayload);
			return `${window.location.origin}/s/${code}`;
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'Failed to create share');
		}
	}

	function handleHandlePointerDown(e: PointerEvent): void {
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		dragging = true;
		dragStartX = e.clientX;
		dragStartWidth = widthPx;
	}

	function handleHandlePointerMove(e: PointerEvent): void {
		if (!dragging) return;
		const delta = dragStartX - e.clientX; // moving left widens the right-anchored drawer
		widthPx = clampWidth(dragStartWidth + delta, viewportWidth);
	}

	function handleHandlePointerUp(e: PointerEvent): void {
		if (!dragging) return;
		const target = e.currentTarget as HTMLElement;
		if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
		dragging = false;
		persistWidth(widthPx);
	}

	function resetWidth(): void {
		removeKey(DRAWER_WIDTH_KEY);
		widthPx = clampWidth(viewportWidth * DEFAULT_DRAWER_FRACTION, viewportWidth);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet traceSummary()}
	{#if traceId}
		{@const id = traceId}
		<CopyButton
			text={id}
			class="border-line bg-base-200/60 text-muted hover:bg-base-300 hover:text-base-content inline-flex h-7 items-center gap-1.5 rounded border px-2 text-xs transition-colors"
			aria-label="Copy trace ID"
			title={`Copy trace ID: ${id}`}
		>
			Trace ID
		</CopyButton>
		<a
			href={traceDetailHref(id, { index: store.selectedIndex, returnTo: page.url })}
			class="btn btn-xs btn-primary ml-auto"
		>
			<ExternalLink class="size-3" aria-hidden="true" />
			Open trace page
		</a>
	{/if}
{/snippet}

{#if hit && store.fieldConfig && widthPx > 0}
	<button
		type="button"
		class="bg-base-content/40 fixed inset-0 z-40"
		aria-label="Close detail"
		onclick={close}
	></button>

	<div
		bind:this={dialogRef}
		tabindex={-1}
		class="border-line bg-base-100 fixed top-0 right-0 z-50 flex h-full max-w-full flex-col border-l shadow-lg outline-none"
		style="width: {widthPx}px"
		role="dialog"
		aria-modal="true"
		aria-labelledby="log-detail-title"
	>
		<!-- Mouse-only affordance with no keyboard equivalent, so aria-hidden + tabindex="-1" is deliberate. -->
		<button
			type="button"
			tabindex="-1"
			aria-hidden="true"
			title="Drag to resize · double-click to reset"
			class={[
				'border-line bg-base-100 text-muted hover:bg-base-200 hover:text-base-content rounded-box absolute top-1/2 left-0 -ml-2 flex h-8 w-4 -translate-x-full -translate-y-1/2 cursor-ew-resize items-center justify-center border transition-colors',
				dragging && 'bg-base-200 text-base-content'
			]}
			onpointerdown={handleHandlePointerDown}
			onpointermove={handleHandlePointerMove}
			onpointerup={handleHandlePointerUp}
			onpointercancel={handleHandlePointerUp}
			ondblclick={resetWidth}
		>
			<GripVertical class="size-3" aria-hidden="true" />
		</button>

		<DrawerHeader
			{hit}
			{activeTab}
			{hasTraceback}
			hasTrace={traceId !== null}
			meta={traceSummary}
			onTabChange={(t) => {
				activeTab = t;
				selectedSpanId = null;
			}}
			onShare={shareLog}
			onClose={close}
		/>

		<div
			class="min-h-0 flex-1"
			role="tabpanel"
			id={`drawer-panel-${activeTab}`}
			aria-labelledby={`drawer-tab-${activeTab}`}
		>
			{#if activeTab === 'parameters'}
				<ParametersPane {hit} {store} />
			{:else if activeTab === 'traceback'}
				<TracebackPane value={traceback} />
			{:else if activeTab === 'trace'}
				{#await traceLoad?.model}
					<div role="status" class="flex h-full items-center justify-center">
						<span class="loading loading-spinner loading-sm"></span>
						<span class="sr-only">Loading trace</span>
					</div>
				{:then model}
					{#if model}
						{@const span = selectedSpanId ? model.byId.get(selectedSpanId) : undefined}
						<TracePane
							{model}
							{selectedSpanId}
							onSelectSpan={(id) => (selectedSpanId = id)}
							onReload={() => traceId && loadTrace(traceId)}
						/>
						{#if span}
							<!-- Positioned against the fixed dialog; the strip left uncovered keeps the drawer in view. -->
							<div
								tabindex="-1"
								class="border-line bg-base-100 absolute inset-y-0 right-0 z-10 w-[88%] border-l shadow-lg outline-none"
								aria-label="Span detail"
								role="region"
								{@attach focusOnCreate}
							>
								<SpanDetailPane
									{span}
									resources={model.resources}
									traceStartMicros={model.traceStartMicros}
									onSelectSpan={(id) => (selectedSpanId = id)}
									onClose={closeSpan}
									logsHref={null}
								/>
							</div>
						{/if}
					{/if}
				{:catch e}
					<div
						role="alert"
						class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
					>
						<p class="text-warning-ink text-sm">
							{e instanceof Error ? e.message : 'Failed to load trace'}
						</p>
						<button
							type="button"
							class="btn btn-sm btn-ghost gap-1.5"
							onclick={() => traceId && loadTrace(traceId)}
						>
							<RotateCw class="size-3.5" aria-hidden="true" />
							Try again
						</button>
					</div>
				{/await}
			{:else if activeTab === 'context'}
				<ContextPane
					{hit}
					{store}
					onCloseDrawer={close}
					onReplaceHit={(h) => {
						onReplaceHit(h);
						activeTab = 'parameters';
						queueMicrotask(() => dialogRef?.focus());
					}}
				/>
			{:else}
				<JsonPane raw={hit.raw} />
			{/if}
		</div>
	</div>
{/if}
