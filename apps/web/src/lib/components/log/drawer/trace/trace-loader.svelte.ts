import { getUnixTime, isValid, parseISO } from 'date-fns';

import { searchLogs } from '$lib/api/log-search';
import { isAbortError } from '$lib/api/errors';
import { escapeFilterValue } from 'api/query';
import type { LogHit, SpanNode } from '$lib/types';

/** Matches the Context pane's window. Bounds the query so Quickwit prunes to a few time partitions. */
// ponytail: ±15min window; widen if inter-service clock skew starts hiding spans.
const WINDOW_HALF_SECONDS = 15 * 60;
const SPAN_LIMIT = 500;
/** Spans of a few tens of microseconds are normal; without a floor their bar renders zero-width. */
const MIN_WIDTH_PCT = 0.4;

function str(v: unknown): string | null {
	return typeof v === 'string' && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Quickwit writes `{"code":"error"}` and omits the field entirely when the status is unset. */
function isErrorStatus(v: unknown): boolean {
	if (v === null || typeof v !== 'object') return false;
	return (v as Record<string, unknown>)['code'] === 'error';
}

export class TraceLoader {
	readonly indexId: string;
	readonly traceId: string;
	readonly anchorSpanId: string | null;
	readonly anchorTs: number;

	roots = $state.raw<SpanNode[]>([]);
	spanCount = $state(0);
	totalHits = $state(0);
	serviceCount = $state(0);
	durationNanos = $state(0);
	loading = $state(false);
	error = $state<string | null>(null);

	#abort: AbortController | null = null;

	constructor(anchor: LogHit, indexId: string, traceId: string) {
		this.indexId = indexId;
		this.traceId = traceId;
		this.anchorSpanId = str(anchor.raw['span_id']);
		const parsed = parseISO(anchor.timestamp);
		this.anchorTs = isValid(parsed) ? getUnixTime(parsed) : NaN;
	}

	async init(): Promise<void> {
		if (Number.isNaN(this.anchorTs)) {
			this.error = 'This log has no usable timestamp, so its trace cannot be located.';
			return;
		}
		this.#abort = new AbortController();
		this.loading = true;
		try {
			const result = await searchLogs(
				{
					indexId: this.indexId,
					query: `trace_id:${escapeFilterValue(this.traceId)}`,
					limit: SPAN_LIMIT,
					offset: 0,
					sortDirection: 'asc',
					startTimestamp: this.anchorTs - WINDOW_HALF_SECONDS,
					endTimestamp: this.anchorTs + WINDOW_HALF_SECONDS
				},
				{ countAll: true, signal: this.#abort.signal }
			);
			this.totalHits = result.numHits;
			this.#build(result.rawHits);
		} catch (e) {
			if (isAbortError(e)) return;
			this.error = e instanceof Error ? e.message : 'Failed to load trace';
		} finally {
			this.loading = false;
		}
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}

	#build(raws: Record<string, unknown>[]): void {
		const byId = new Map<string, SpanNode>();
		const services = new Set<string>();

		for (const raw of raws) {
			const spanId = str(raw['span_id']);
			const startNanos = num(raw['span_start_timestamp_nanos']);
			const endNanos = num(raw['span_end_timestamp_nanos']);
			if (!spanId || startNanos === null || endNanos === null) continue;
			if (byId.has(spanId)) continue;
			const serviceName = str(raw['service_name']) ?? 'unknown';
			services.add(serviceName);
			byId.set(spanId, {
				spanId,
				parentSpanId: str(raw['parent_span_id']),
				name: str(raw['span_name']) ?? '(unnamed)',
				serviceName,
				startNanos,
				endNanos: Math.max(endNanos, startNanos),
				isError: isErrorStatus(raw['span_status']),
				depth: 0,
				offsetPct: 0,
				widthPct: 0,
				children: []
			});
		}

		const nodes = [...byId.values()];
		if (nodes.length === 0) return;

		// A parent absent from the result set (truncation, partial ingest, or a root span, which
		// carries no parent_span_id at all) makes its child a root, so the forest never loses spans.
		const roots: SpanNode[] = [];
		for (const node of nodes) {
			const parent = node.parentSpanId ? byId.get(node.parentSpanId) : undefined;
			if (parent && parent !== node) parent.children.push(node);
			else roots.push(node);
		}

		const traceStart = Math.min(...nodes.map((n) => n.startNanos));
		const traceEnd = Math.max(...nodes.map((n) => n.endNanos));
		const total = Math.max(traceEnd - traceStart, 1);

		const visited = new Set<string>();
		const walk = (node: SpanNode, depth: number): void => {
			visited.add(node.spanId);
			node.depth = depth;
			const rawOffsetPct = ((node.startNanos - traceStart) / total) * 100;
			node.widthPct = Math.max(((node.endNanos - node.startNanos) / total) * 100, MIN_WIDTH_PCT);
			node.offsetPct = Math.min(rawOffsetPct, 100 - node.widthPct);
			// A span's parent chain can loop back on itself; dropping already-visited children severs the
			// back-edge so the forest handed to the renderer is acyclic, without losing either span.
			node.children = node.children.filter((child) => !visited.has(child.spanId));
			node.children.sort((a, b) => a.startNanos - b.startNanos);
			for (const child of node.children) walk(child, depth + 1);
		};
		for (const root of roots) walk(root, 0);

		// A parent cycle leaves its members unreachable from any root. Surface them rather than
		// dropping spans the user can see in the JSON.
		for (const node of nodes) {
			if (visited.has(node.spanId)) continue;
			roots.push(node);
			walk(node, 0);
		}
		roots.sort((a, b) => a.startNanos - b.startNanos);

		this.roots = roots;
		this.spanCount = nodes.length;
		this.serviceCount = services.size;
		this.durationNanos = traceEnd - traceStart;
	}
}
