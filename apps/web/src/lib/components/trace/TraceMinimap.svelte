<script lang="ts">
	import { ZoomOut } from 'lucide-svelte';

	import { serviceColor } from '$lib/utils/service-color';
	import { traceAxis } from '$lib/utils/trace-axis';
	import TraceAxisTicks from './TraceAxisTicks.svelte';
	import { fullView, MIN_VIEW_SPAN } from './trace-model';
	import type { SpanNode, ViewRange } from '$lib/types';

	let {
		spans,
		durationMicros,
		view,
		onChange
	}: {
		spans: ReadonlyMap<string, SpanNode>;
		durationMicros: number;
		view: ViewRange;
		onChange: (next: ViewRange) => void;
	} = $props();

	const TICK_H = 18;
	const BAR_AREA_H = 34;
	const BAR_H = 2;
	/** Grab zone on each side of the viewport frame, in px. */
	const HANDLE_PX = 8;
	/** The frame never draws narrower than this, however deep the zoom goes. */
	const FRAME_MIN_PX = 3;
	/** Without a floor a sub-microsecond span leaves no mark at all in the strip. */
	const MIN_BAR_PCT = 0.15;
	/** Horizontal resolution the strip is quantised to before rendering. */
	const BAR_COLUMNS = 400;
	const KEY_STEP = 0.05;

	const axis = $derived(traceAxis(durationMicros));

	/**
	 * Depth compresses into the bar band rather than mapping 1:1, and bars landing on the same slot
	 * and column are dropped: 2,000 spans in 34px would otherwise stack invisibly on each other.
	 */
	const bars = $derived.by(() => {
		const total = Math.max(durationMicros, 1);
		let maxDepth = 1;
		for (const span of spans.values()) maxDepth = Math.max(maxDepth, span.depth);
		const slot = BAR_AREA_H - BAR_H - 4;
		const seen = new Set<string>();
		const out: { id: string; left: number; width: number; top: number; color: string }[] = [];
		for (const span of spans.values()) {
			const left = (span.startOffsetMicros / total) * 100;
			const width = Math.max((span.durationMicros / total) * 100, MIN_BAR_PCT);
			const top = TICK_H + 2 + Math.round((span.depth / maxDepth) * slot);
			const id = `${top}:${Math.round((left / 100) * BAR_COLUMNS)}:${Math.round((width / 100) * BAR_COLUMNS)}:${span.serviceName}`;
			if (seen.has(id)) continue;
			seen.add(id);
			out.push({ id, left, width, top, color: serviceColor(span.serviceName) });
		}
		return out;
	});

	const zoomed = $derived(view.start > 0 || view.end < 1);

	type Mode = 'brush' | 'pan' | 'resize-left' | 'resize-right';

	let track = $state<HTMLDivElement | null>(null);
	let drag = $state<{
		mode: Mode;
		startX: number;
		from: ViewRange;
		anchor: number;
		moved: boolean;
	} | null>(null);
	let brush = $state<ViewRange | null>(null);
	let cursor = $state('crosshair');

	// Cached because hover calls modeAt on every pointermove, and an uncached read is a forced layout
	// per event. Non-null asserted: every reader runs from an event on `track` itself.
	let cachedRect: DOMRect | null = null;
	const rect = (): DOMRect => (cachedRect ??= track!.getBoundingClientRect());

	const clamp = (n: number, lo = 0, hi = 1): number => Math.min(Math.max(n, lo), hi);

	const fractionAt = (clientX: number): number => {
		const box = rect();
		return clamp((clientX - box.left) / box.width);
	};

	function modeAt(at: number): Mode {
		if (!zoomed) return 'brush';
		const box = rect();
		const grab = HANDLE_PX / box.width;
		// The frame as drawn, not the logical range: past a certain zoom both edges are the same
		// fraction, and testing them in order would hand every press to the left handle.
		const end = Math.max(view.end, view.start + FRAME_MIN_PX / box.width);
		const toStart = Math.abs(at - view.start);
		const toEnd = Math.abs(at - end);
		if (toStart < grab || toEnd < grab) return toEnd < toStart ? 'resize-right' : 'resize-left';
		if (at > view.start && at < end) return 'pan';
		return 'brush';
	}

	const cursorFor = (mode: Mode): string =>
		mode === 'pan' ? 'grab' : mode === 'brush' ? 'crosshair' : 'col-resize';

	function down(event: PointerEvent): void {
		// preventDefault kills text selection and the native drag, and the focus default with them.
		event.preventDefault();
		track?.focus();
		cachedRect = null;
		try {
			// Best-effort: keeps a drag alive past the strip's edges, and throws on a pointer the
			// browser no longer considers active. `up()` on window covers the failure.
			track?.setPointerCapture(event.pointerId);
		} catch {
			/* empty */
		}
		const at = fractionAt(event.clientX);
		const mode = modeAt(at);
		drag = { mode, startX: event.clientX, from: { ...view }, anchor: at, moved: false };
		if (mode === 'brush') brush = { start: at, end: at };
		cursor = mode === 'pan' ? 'grabbing' : cursorFor(mode);
	}

	function move(event: PointerEvent): void {
		if (drag === null) {
			cursor = cursorFor(modeAt(fractionAt(event.clientX)));
			return;
		}
		drag.moved = true;

		if (drag.mode === 'brush') {
			// Anchored to the press point, not the live selection: reading it back would make a
			// leftward drag widen the brush instead of shrinking it.
			const at = fractionAt(event.clientX);
			brush = { start: Math.min(drag.anchor, at), end: Math.max(drag.anchor, at) };
			return;
		}

		const delta = (event.clientX - drag.startX) / rect().width;
		const { start, end } = drag.from;
		if (drag.mode === 'pan') {
			const width = end - start;
			const next = clamp(start + delta, 0, 1 - width);
			onChange({ start: next, end: next + width });
		} else if (drag.mode === 'resize-left') {
			onChange({ start: clamp(start + delta, 0, end - MIN_VIEW_SPAN), end });
		} else {
			onChange({ start, end: clamp(end + delta, start + MIN_VIEW_SPAN, 1) });
		}
	}

	function up(): void {
		if (drag === null) return;
		const { mode, moved } = drag;
		const selected = brush;
		drag = null;
		brush = null;
		cursor = 'crosshair';
		if (mode !== 'brush') return;
		// Travel, not width: a width threshold would reject the deliberate one-pixel drags that are
		// the only way to reach a useful window on a trace with this much dead time.
		if (moved && selected !== null && selected.end - selected.start > MIN_VIEW_SPAN) {
			onChange(selected);
		}
	}

	function key(event: KeyboardEvent): void {
		const width = view.end - view.start;
		const pan = (by: number): ViewRange => {
			const shift = Math.max(Math.min(by, 1 - view.end), -view.start);
			return { start: view.start + shift, end: view.end + shift };
		};
		const zoom = (factor: number): ViewRange => {
			const mid = (view.start + view.end) / 2;
			const half = clamp((width * factor) / 2, MIN_VIEW_SPAN / 2, 0.5);
			return { start: clamp(mid - half), end: clamp(mid + half) };
		};
		// No Escape: it belongs to whatever dismisses the surrounding surface.
		const next =
			event.key === 'ArrowLeft'
				? pan(-width * KEY_STEP)
				: event.key === 'ArrowRight'
					? pan(width * KEY_STEP)
					: event.key === '+' || event.key === '='
						? zoom(0.5)
						: event.key === '0'
							? fullView()
							: null;
		if (next === null) return;
		event.preventDefault();
		onChange(next);
	}
</script>

<!-- On window, not the track: without pointer capture a release outside the strip never reaches it,
     and the drag would run on against the bare cursor. -->
<svelte:window
	onpointerup={up}
	onpointercancel={up}
	onresize={() => (cachedRect = null)}
	onscroll={() => (cachedRect = null)}
/>

<!-- A two-ended range has no single ARIA role, so: a group that carries the focus and gestures, with
     the value announced from the live region rather than a valuenow that could only describe one edge. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={track}
	role="group"
	tabindex="0"
	aria-label="Timeline view range — drag to zoom, arrows to pan, plus and minus to zoom, 0 to reset"
	class="border-line bg-base-200/40 relative touch-none overflow-hidden border-b select-none"
	style={`height:${TICK_H + BAR_AREA_H}px;cursor:${cursor};${axis.gridStyle}`}
	onpointerdown={down}
	onpointermove={move}
	ondblclick={() => zoomed && onChange(fullView())}
	onkeydown={key}
>
	<span class="sr-only" aria-live="polite">
		Showing {Math.round(view.start * 100)}% to {Math.round(view.end * 100)}% of the trace
	</span>

	<TraceAxisTicks ticks={axis.ticks} />

	{#each bars as bar (bar.id)}
		<div
			class="pointer-events-none absolute rounded-[1px]"
			style={`left:${bar.left}%;width:${bar.width}%;top:${bar.top}px;height:${BAR_H}px;background-color:${bar.color}`}
		></div>
	{/each}

	{#if zoomed}
		<div
			class="bg-base-100/65 pointer-events-none absolute inset-y-0 left-0"
			style={`width:${view.start * 100}%`}
		></div>
		<div
			class="bg-base-100/65 pointer-events-none absolute inset-y-0 right-0"
			style={`width:${(1 - view.end) * 100}%`}
		></div>
		<!-- A deep zoom is a sub-pixel slice of the full trace; without a floor the frame vanishes. -->
		<div
			class="border-primary pointer-events-none absolute inset-y-0 border"
			style={`left:${view.start * 100}%;width:${(view.end - view.start) * 100}%;min-width:${FRAME_MIN_PX}px`}
		>
			{#each ['-left-[3px]', '-right-[3px]'] as side (side)}
				<span class={['bg-primary absolute top-1/2 h-5 w-1.5 -translate-y-1/2 rounded-[2px]', side]}
				></span>
			{/each}
		</div>

		<button
			type="button"
			class="btn btn-xs btn-square absolute top-1 right-1 z-10"
			aria-label="Reset zoom"
			title="Reset zoom"
			onpointerdown={(e) => e.stopPropagation()}
			ondblclick={(e) => e.stopPropagation()}
			onclick={() => onChange(fullView())}
		>
			<ZoomOut class="h-3 w-3" />
		</button>
	{/if}

	{#if brush !== null}
		<div
			class="border-primary bg-primary/20 pointer-events-none absolute inset-y-0 border"
			style={`left:${brush.start * 100}%;width:${(brush.end - brush.start) * 100}%`}
		></div>
	{/if}
</div>
