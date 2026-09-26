import type { SpanNode, TraceModel, ViewRange } from '$lib/types';
import type { TraceResponse } from 'api/types';

export function buildTraceModel(trace: TraceResponse): TraceModel {
	const byId = new Map<string, SpanNode>();
	for (const s of trace.spans) {
		byId.set(s.spanId, { ...s, depth: 0, children: [] });
	}

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
	let orphanCount = 0;
	for (const node of nodes) {
		const parent = node.parentSpanId ? byId.get(node.parentSpanId) : undefined;
		if (parent && parent !== node) parent.children.push(node);
		else {
			// A parent is only exported once it ends, so its children can arrive first.
			if (node.parentSpanId && !parent) orphanCount++;
			roots.push(node);
		}
	}

	const visited = new Set<string>();
	const walk = (node: SpanNode, depth: number): void => {
		visited.add(node.spanId);
		node.depth = depth;
		// Parent chains can loop; dropping visited children stops infinite recursion.
		node.children = node.children.filter((child) => !visited.has(child.spanId));
		node.children.sort((a, b) => a.startOffsetMicros - b.startOffsetMicros);
		for (const child of node.children) walk(child, depth + 1);
	};
	for (const root of roots) walk(root, 0);

	// Cycle members are unreachable from any root.
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
		orphanCount,
		resources: trace.resources,
		traceStartMicros: trace.traceStartMicros,
		byId
	};
}

/** Newline-joined so a needle can't match across two fields. */
export function spanSearchText(node: SpanNode): string {
	const attributes = Object.entries(node.attributes).map(([key, value]) => `${key}=${value}`);
	return [node.serviceName, node.name, node.spanId, ...attributes].join('\n').toLowerCase();
}

export const fullView = (): ViewRange => ({ start: 0, end: 1 });
