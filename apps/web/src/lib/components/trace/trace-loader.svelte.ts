import { isAbortError } from '$lib/api/errors';
import { fetchTrace } from '$lib/api/trace';
import type { SpanNode } from '$lib/types';
import type { TraceSpan } from 'api/types';

/** Spans of a few tens of microseconds are normal; without a floor their bar renders zero-width. */
const MIN_WIDTH_PCT = 0.4;

export class TraceLoader {
	readonly traceId: string;

	roots = $state.raw<SpanNode[]>([]);
	spanCount = $state(0);
	durationMicros = $state(0);
	services = $state.raw<{ name: string; count: number }[]>([]);
	errorCount = $state(0);
	loading = $state(false);
	error = $state<string | null>(null);

	#abort: AbortController | null = null;

	constructor(traceId: string) {
		this.traceId = traceId;
	}

	async init(): Promise<void> {
		this.#abort = new AbortController();
		this.loading = true;
		try {
			const { spans } = await fetchTrace(this.traceId, { signal: this.#abort.signal });
			this.#build(spans);
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

	#build(spans: TraceSpan[]): void {
		const byId = new Map<string, SpanNode>();
		for (const s of spans) {
			byId.set(s.spanId, { ...s, depth: 0, offsetPct: 0, widthPct: 0, children: [] });
		}

		const nodes = [...byId.values()];
		this.spanCount = nodes.length;
		if (nodes.length === 0) return;

		const spansPerService = new Map<string, number>();
		let durationMicros = 0;
		let errorCount = 0;
		for (const node of nodes) {
			spansPerService.set(node.serviceName, (spansPerService.get(node.serviceName) ?? 0) + 1);
			if (node.isError) errorCount++;
			durationMicros = Math.max(durationMicros, node.startOffsetMicros + node.durationMicros);
		}
		this.services = [...spansPerService]
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
		this.errorCount = errorCount;
		this.durationMicros = durationMicros;

		const roots: SpanNode[] = [];
		for (const node of nodes) {
			const parent = node.parentSpanId ? byId.get(node.parentSpanId) : undefined;
			if (parent && parent !== node) parent.children.push(node);
			else roots.push(node);
		}

		const total = Math.max(durationMicros, 1);
		const visited = new Set<string>();
		const walk = (node: SpanNode, depth: number): void => {
			visited.add(node.spanId);
			node.depth = depth;
			const rawOffsetPct = (node.startOffsetMicros / total) * 100;
			node.widthPct = Math.max((node.durationMicros / total) * 100, MIN_WIDTH_PCT);
			node.offsetPct = Math.min(rawOffsetPct, 100 - node.widthPct);
			// Severs back-edges: a parent chain can loop, and walk() would recurse forever.
			node.children = node.children.filter((child) => !visited.has(child.spanId));
			node.children.sort((a, b) => a.startOffsetMicros - b.startOffsetMicros);
			for (const child of node.children) walk(child, depth + 1);
		};
		for (const root of roots) walk(root, 0);

		// Members of a parent cycle are unreachable from any root; surface them rather than drop them.
		for (const node of nodes) {
			if (visited.has(node.spanId)) continue;
			roots.push(node);
			walk(node, 0);
		}
		roots.sort((a, b) => a.startOffsetMicros - b.startOffsetMicros);

		this.roots = roots;
	}
}
