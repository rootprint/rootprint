<script lang="ts">
	import { GripVertical } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import DrawerHeader, { type DrawerTab } from './drawer/DrawerHeader.svelte';
	import DrawerSearchBox from './drawer/DrawerSearchBox.svelte';
	import ContextPane from './drawer/ContextPane.svelte';
	import JsonPane from './drawer/JsonPane.svelte';
	import ParametersPane from './drawer/ParametersPane.svelte';
	import { createShare } from '$lib/api/shares';
	import { ApiError } from '$lib/api/errors';
	import { copyWithToast } from '$lib/utils/clipboard';
	import type { LogHit } from '$lib/types';
	import type { SearchStore } from '$lib/stores/search.svelte';

	const MAX_HIT_BYTES = 60 * 1024;

	const DRAWER_WIDTH_KEY = 'rootprint.drawerWidth';
	const MIN_DRAWER_WIDTH = 400;
	const MAX_DRAWER_WIDTH_FRACTION = 0.9;
	const DEFAULT_DRAWER_FRACTION = 0.5;
	const KEYBOARD_STEP_PX = 24;
	const KEYBOARD_STEP_SHIFT_PX = 96;

	function clampWidth(px: number, viewport: number): number {
		// Never let the floor exceed the viewport itself — on narrow windows the
		// drawer would otherwise overflow and break the ARIA range invariant.
		const min = Math.min(MIN_DRAWER_WIDTH, viewport);
		const max = Math.max(min, Math.floor(viewport * MAX_DRAWER_WIDTH_FRACTION));
		return Math.min(max, Math.max(min, Math.round(px)));
	}

	function readStoredWidth(): number | null {
		try {
			const raw = localStorage.getItem(DRAWER_WIDTH_KEY);
			if (raw === null) return null;
			const parsed = Number(raw);
			return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
		} catch {
			return null;
		}
	}

	function persistWidth(px: number): void {
		try {
			localStorage.setItem(DRAWER_WIDTH_KEY, String(px));
		} catch {
			// ignore quota / privacy-mode failures
		}
	}

	let {
		hit,
		onClose,
		store
	}: {
		hit: LogHit | null;
		onClose: () => void;
		store: SearchStore;
	} = $props();

	let activeTab = $state<DrawerTab>('parameters');
	let searchOpen = $state(false);
	let searchTerm = $state('');
	let sharing = $state(false);
	let dialogRef: HTMLDivElement | null = $state(null);
	let previousFocus: HTMLElement | null = null;

	let widthPx = $state<number>(0);
	let viewportWidth = $state<number>(0);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartWidth = 0;

	const ariaValueMin = $derived(Math.min(MIN_DRAWER_WIDTH, viewportWidth));
	const ariaValueMax = $derived(
		Math.max(ariaValueMin, Math.floor(viewportWidth * MAX_DRAWER_WIDTH_FRACTION))
	);

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
		if (hit) {
			activeTab = 'parameters';
			searchOpen = false;
			searchTerm = '';
			previousFocus = document.activeElement as HTMLElement | null;
			queueMicrotask(() => dialogRef?.focus());
		}
	});

	function close() {
		onClose();
		queueMicrotask(() => previousFocus?.focus());
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!hit) return;
		if (e.key === 'Escape') {
			const target = e.target as HTMLElement | null;
			if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
			e.preventDefault();
			close();
		}
	}

	async function shareLog() {
		if (!hit || !store.fieldConfig) return;
		const indexId = store.selectedIndex;
		const startTime = store.resolvedStartTs;
		const endTime = store.resolvedEndTs;
		if (indexId === null || startTime === undefined || endTime === undefined) {
			toast.error('Search context not ready');
			return;
		}
		const payloadSize = new TextEncoder().encode(JSON.stringify(hit.raw)).byteLength;
		if (payloadSize > MAX_HIT_BYTES) {
			toast.error('Log too large to share');
			return;
		}
		sharing = true;
		try {
			const { code } = await createShare({
				indexId,
				query: store.query,
				startTime,
				endTime,
				hit: hit.raw
			});
			const url = `${window.location.origin}/s/${code}`;
			await copyWithToast(url, 'Share link copied', 'Failed to copy share link');
		} catch (e) {
			const msg = e instanceof ApiError ? e.message : 'Failed to create share';
			toast.error(msg);
		} finally {
			sharing = false;
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

	function handleHandleKeydown(e: KeyboardEvent): void {
		const step = e.shiftKey ? KEYBOARD_STEP_SHIFT_PX : KEYBOARD_STEP_PX;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			widthPx = clampWidth(widthPx + step, viewportWidth);
			persistWidth(widthPx);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			widthPx = clampWidth(widthPx - step, viewportWidth);
			persistWidth(widthPx);
		}
	}

	function resetWidth(): void {
		try {
			localStorage.removeItem(DRAWER_WIDTH_KEY);
		} catch {
			// ignore
		}
		widthPx = clampWidth(viewportWidth * DEFAULT_DRAWER_FRACTION, viewportWidth);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

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
		class="border-line bg-base-100 fixed top-0 right-0 z-50 flex h-full max-w-full flex-col border-l shadow-2xl outline-none"
		style="width: {widthPx}px"
		role="dialog"
		aria-modal="true"
		aria-label="Log detail"
	>
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize drawer"
			aria-valuemin={ariaValueMin}
			aria-valuemax={ariaValueMax}
			aria-valuenow={widthPx}
			tabindex="0"
			title="Drag to resize · double-click to reset"
			class={[
				'border-base-content/20 bg-base-100 text-base-content/60 hover:bg-base-200 hover:text-base-content absolute top-1/2 left-0 -ml-2 flex h-8 w-4 -translate-x-full -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-md border shadow-sm transition-colors',
				dragging && 'bg-base-200 text-base-content'
			]}
			onpointerdown={handleHandlePointerDown}
			onpointermove={handleHandlePointerMove}
			onpointerup={handleHandlePointerUp}
			onpointercancel={handleHandlePointerUp}
			ondblclick={resetWidth}
			onkeydown={handleHandleKeydown}
		>
			<GripVertical class="h-3 w-3" />
		</div>

		<DrawerHeader
			{hit}
			timezoneMode={store.timezoneMode}
			{activeTab}
			{sharing}
			onTabChange={(t) => (activeTab = t)}
			onSearch={() => (searchOpen = !searchOpen)}
			onShare={shareLog}
			onClose={close}
		/>

		{#if searchOpen}
			<DrawerSearchBox
				bind:value={searchTerm}
				onClose={() => {
					searchOpen = false;
					searchTerm = '';
				}}
			/>
		{/if}

		<div
			class="min-h-0 flex-1"
			role="tabpanel"
			id={`drawer-panel-${activeTab}`}
			aria-labelledby={`drawer-tab-${activeTab}`}
		>
			{#if activeTab === 'parameters'}
				<ParametersPane {hit} {searchTerm} {store} />
			{:else if activeTab === 'context'}
				<ContextPane {hit} {store} onCloseDrawer={close} />
			{:else}
				<JsonPane raw={hit.raw} />
			{/if}
		</div>
	</div>
{/if}
