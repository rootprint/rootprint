import type { SpanNode, TraceModel } from '$lib/types';
import type { TraceResponse } from 'api/types';

/** Spans of a few tens of microseconds are normal; without a floor their bar renders zero-width. */
const MIN_WIDTH_PCT = 0.4;

/** Shapes a flat span list into the waterfall tree, with geometry precomputed against the trace. */
export function buildTraceModel(trace: TraceResponse): TraceModel {
	const byId = new Map<string, SpanNode>();
	for (const s of trace.spans) {
		byId.set(s.spanId, { ...s, depth: 0, offsetPct: 0, widthPct: 0, children: [] });
	}

	// Duplicate span ids collapse here, so spanCount is distinct ids rather than spans returned.
	const nodes = [...byId.values()];

	const spansPerService = new Map<string, number>();
	let durationMicros = 0;
	let errorCount = 0;
	for (const node of nodes) {
		spansPerService.set(node.serviceName, (spansPerService.get(node.serviceName) ?? 0) + 1);
		if (node.isError) errorCount++;
		durationMicros = Math.max(durationMicros, node.startOffsetMicros + node.durationMicros);
	}
	const services = [...spansPerService]
		.map(([name, count]) => ({ name, count }))
		.toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));

	const roots: SpanNode[] = [];
	let isPartial = false;
	for (const node of nodes) {
		const parent = node.parentSpanId ? byId.get(node.parentSpanId) : undefined;
		if (parent && parent !== node) parent.children.push(node);
		else {
			// A long-running parent is only exported when it ends, so children can be searchable first.
			if (node.parentSpanId && !parent) isPartial = true;
			roots.push(node);
		}
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

	return {
		roots,
		spanCount: nodes.length,
		durationMicros,
		services,
		errorCount,
		isPartial,
		resources: trace.resources,
		traceStartMicros: trace.traceStartMicros,
		byId
	};
}
