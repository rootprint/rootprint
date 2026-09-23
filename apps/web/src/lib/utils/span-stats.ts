import type { SpanNode } from '$lib/types';

/** Semconv ≥1.26 renamed `db.system`→`db.system.name` and `db.statement`→`db.query.text`. */
const DB_SYSTEM_KEYS = ['db.system', 'db.system.name'];
const DB_STATEMENT_KEYS = ['db.statement', 'db.query.text'];

const attr = (span: SpanNode, keys: string[]): string => {
	for (const key of keys) if (span.attributes[key]) return span.attributes[key];
	return '';
};

export interface OperationRollup {
	key: string;
	name: string;
	serviceName: string;
	count: number;
	totalMicros: number;
	slowestSpanId: string;
}

/** Iterative: a recursive spread re-copies subtrees per level, quadratic on deep chains. */
export function spansInTreeOrder(roots: SpanNode[]): SpanNode[] {
	const out: SpanNode[] = [];
	const stack = roots.toReversed();
	for (let node = stack.pop(); node; node = stack.pop()) {
		out.push(node);
		for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
	}
	return out;
}

export function firstErrorSpan(spans: Iterable<SpanNode>): SpanNode | null {
	let first: SpanNode | null = null;
	for (const span of spans) {
		if (span.isError && (!first || span.startOffsetMicros < first.startOffsetMicros)) first = span;
	}
	return first;
}

/** Union of clamped child intervals, not their sum, so overlap and skew can't go negative. */
export function selfMicros(span: SpanNode): number {
	const spanStart = span.startOffsetMicros;
	const spanEnd = spanStart + span.durationMicros;
	const intervals = span.children
		.map((c) => ({
			start: Math.max(c.startOffsetMicros, spanStart),
			end: Math.min(c.startOffsetMicros + c.durationMicros, spanEnd)
		}))
		.filter((i) => i.end > i.start)
		.toSorted((a, b) => a.start - b.start);
	if (intervals.length === 0) return span.durationMicros;

	let covered = 0;
	let { start, end } = intervals[0];
	for (const i of intervals.slice(1)) {
		if (i.start > end) {
			covered += end - start;
			start = i.start;
			end = i.end;
		} else if (i.end > end) {
			end = i.end;
		}
	}
	covered += end - start;
	return Math.max(span.durationMicros - covered, 0);
}

export function topOperations(spans: SpanNode[]): OperationRollup[] {
	const groups = new Map<string, OperationRollup & { slowestMicros: number }>();
	for (const s of spans) {
		// Not `a:b`: span names carry colons.
		const key = JSON.stringify([s.serviceName, s.name]);
		const group = groups.get(key);
		if (!group) {
			groups.set(key, {
				key,
				name: s.name,
				serviceName: s.serviceName,
				count: 1,
				totalMicros: s.durationMicros,
				slowestSpanId: s.spanId,
				slowestMicros: s.durationMicros
			});
			continue;
		}
		group.count++;
		group.totalMicros += s.durationMicros;
		if (s.durationMicros > group.slowestMicros) {
			group.slowestMicros = s.durationMicros;
			group.slowestSpanId = s.spanId;
		}
	}
	return [...groups.values()].toSorted((a, b) => b.totalMicros - a.totalMicros).slice(0, 5);
}

const dbSystem = (span: SpanNode): string => attr(span, DB_SYSTEM_KEYS);

const isDbSpan = (span: SpanNode): boolean =>
	Boolean(dbSystem(span) || attr(span, DB_STATEMENT_KEYS));

function dbStatement(span: SpanNode): string {
	return attr(span, DB_STATEMENT_KEYS).trim() || span.name;
}

export interface DbQuery {
	key: string;
	statement: string;
	errorCount: number;
	totalMicros: number;
	calls: SpanNode[];
}

export interface DbTarget {
	key: string;
	system: string;
	host: string;
	count: number;
	totalMicros: number;
	queries: DbQuery[];
}

/** `net.peer.name` predates semconv 1.21's `server.address`. */
const DB_HOST_KEYS = ['server.address', 'net.peer.name'];

/** Groups on the raw statement: instrumentations already send it sanitized or parameterized. */
export function dbRollups(spans: SpanNode[]): DbTarget[] {
	const targets = new Map<string, DbTarget>();
	const queries = new Map<string, DbQuery>();
	for (const s of spans) {
		if (!isDbSpan(s)) continue;
		const system = dbSystem(s);
		const host = attr(s, DB_HOST_KEYS);
		const statement = dbStatement(s);

		const targetKey = JSON.stringify([system, host]);
		let target = targets.get(targetKey);
		if (!target) {
			target = { key: targetKey, system, host, count: 0, totalMicros: 0, queries: [] };
			targets.set(targetKey, target);
		}
		target.count++;
		target.totalMicros += s.durationMicros;

		const queryKey = JSON.stringify([system, host, statement]);
		let query = queries.get(queryKey);
		if (!query) {
			query = { key: queryKey, statement, errorCount: 0, totalMicros: 0, calls: [] };
			queries.set(queryKey, query);
			target.queries.push(query);
		}
		if (s.isError) query.errorCount++;
		query.totalMicros += s.durationMicros;
		query.calls.push(s);
	}
	for (const target of targets.values()) {
		target.queries.sort((a, b) => b.totalMicros - a.totalMicros);
		for (const query of target.queries) {
			query.calls.sort((a, b) => a.startOffsetMicros - b.startOffsetMicros);
		}
	}
	return [...targets.values()].toSorted((a, b) => b.totalMicros - a.totalMicros);
}

export function exceptionHeadline(fields: Record<string, string>): string {
	return [fields['exception.type'], fields['exception.message']].filter(Boolean).join(': ');
}

/** Keys are doubled up: semconv 1.21→1.26 renamed HTTP and messaging attributes. */
export function describeSpan(span: SpanNode): { kind: string; detail: string } | null {
	const a = span.attributes;

	const method = a['http.request.method'] || a['http.method'];
	if (method) {
		const target = a['http.route'] || a['url.path'] || a['http.target'] || a['url.full'];
		const status = a['http.response.status_code'] || a['http.status_code'];
		return {
			kind: 'HTTP',
			detail: [method, target, status && `→ ${status}`].filter(Boolean).join(' ')
		};
	}

	if (isDbSpan(span)) return { kind: dbSystem(span) || 'Database', detail: dbStatement(span) };

	const rpcService = a['rpc.service'];
	const rpcMethod = a['rpc.method'];
	if (rpcService || rpcMethod) {
		return {
			kind: a['rpc.system'] || 'RPC',
			detail: [rpcService, rpcMethod].filter(Boolean).join('/')
		};
	}

	const destination = a['messaging.destination.name'] || a['messaging.destination'];
	if (destination) {
		const operation = a['messaging.operation.name'] || a['messaging.operation'];
		return {
			kind: a['messaging.system'] || 'Messaging',
			detail: operation ? `${operation} → ${destination}` : destination
		};
	}

	return null;
}
