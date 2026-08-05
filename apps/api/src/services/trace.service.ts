import { QuickwitError, QuickwitErrorCode, type QuickwitClient } from 'quickwit-js';

import type { TraceResponse, TraceSpan } from '../types.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

const NANOS_PER_MICRO = 1_000;

const MAX_TRACE_SPANS = 2_000;

const REDUNDANT_ATTRIBUTES = ['otel.status_code', 'error'];

/** OTel SpanKind → Jaeger's `span.kind` tag. 0 and 1 emit no tag, per the OTel-to-Jaeger spec. */
const SPAN_KIND_TAGS: Record<number, string> = {
	2: 'server',
	3: 'client',
	4: 'producer',
	5: 'consumer'
};

/** `span_status` is `{code:"error"}` — a string, not the OTLP enum; `span_status.code:2` matches nothing. */
const isErrorStatus = (status: unknown): boolean =>
	typeof status === 'object' &&
	status !== null &&
	String((status as { code?: unknown }).code ?? '').toLowerCase() === 'error';

const statusMessageOf = (status: unknown): string | null => {
	if (!isErrorStatus(status)) return null;
	const message = (status as { message?: unknown }).message;
	return typeof message === 'string' && message !== '' ? message : null;
};

function flattenAttributes(
	source: Record<string, unknown>,
	out: Record<string, string> = {},
	prefix = ''
): Record<string, string> {
	for (const [key, value] of Object.entries(source)) {
		const path = prefix === '' ? key : `${prefix}.${key}`;
		if (value === null || value === undefined) continue;
		if (Array.isArray(value)) out[path] = JSON.stringify(value);
		else if (typeof value === 'object')
			flattenAttributes(value as Record<string, unknown>, out, path);
		else out[path] = String(value);
	}
	return out;
}

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

/**
 * Quickwit lifts `service.name` out into its own column at ingest, so hashing `resource_attributes`
 * alone merges two services that share a host — the dev data has exactly that pair.
 */
function resourceKeyOf(serviceName: string, attributes: Record<string, string>): string {
	const sorted = Object.keys(attributes)
		.toSorted()
		.map((key) => [key, attributes[key]]);
	return JSON.stringify([serviceName, sorted]);
}

interface RawSpanHit {
	span_id?: unknown;
	parent_span_id?: unknown;
	span_name?: unknown;
	span_kind?: unknown;
	service_name?: unknown;
	span_start_timestamp_nanos?: unknown;
	span_end_timestamp_nanos?: unknown;
	span_status?: unknown;
	span_attributes?: unknown;
	resource_attributes?: unknown;
	events?: unknown;
}

const toMicros = (v: unknown): number | null =>
	typeof v === 'number' && Number.isFinite(v) ? Math.round(v / NANOS_PER_MICRO) : null;

const asText = (v: unknown, fallback: string): string =>
	typeof v === 'string' && v !== '' ? v : fallback;

const emptyTrace = (truncated = false): TraceResponse => ({
	spans: [],
	traceStartMicros: 0,
	resources: {},
	truncated
});

export async function getTrace(
	qw: QuickwitClient,
	traceIndexId: string,
	traceId: string
): Promise<TraceResponse> {
	const idx = qw.index(traceIndexId);
	const builder = idx.query(`trace_id:${traceId}`).limit(MAX_TRACE_SPANS);
	const response = await idx.search<RawSpanHit>(builder).catch((err: unknown) => {
		if (err instanceof QuickwitError && err.code === QuickwitErrorCode.NOT_FOUND) return null;
		return translateQuickwitError(err);
	});
	if (response === null || response.hits.length === 0) return emptyTrace();

	let truncated = response.num_hits > response.hits.length;

	const seen = new Set<string>();
	const resourceIds = new Map<string, string>();
	const resources: Record<string, Record<string, string>> = {};
	const spans: TraceSpan[] = [];

	for (const hit of response.hits) {
		const spanId = asText(hit.span_id, '');
		const startMicros = toMicros(hit.span_start_timestamp_nanos);
		if (spanId === '' || startMicros === null) {
			truncated = true;
			continue;
		}
		if (seen.has(spanId)) continue;
		seen.add(spanId);

		const serviceName = asText(hit.service_name, 'unknown');
		const resourceAttributes = flattenAttributes(asRecord(hit.resource_attributes));
		const resourceKey = resourceKeyOf(serviceName, resourceAttributes);
		let resourceId = resourceIds.get(resourceKey);
		if (resourceId === undefined) {
			resourceId = `r${resourceIds.size}`;
			resourceIds.set(resourceKey, resourceId);
			resources[resourceId] = resourceAttributes;
		}

		const attributes = flattenAttributes(asRecord(hit.span_attributes));
		// Both restate `isError`, which the span already carries; the message survives as
		// `otel.status_description` below. Envoy and Istio set `error` on ~every failing span.
		for (const key of REDUNDANT_ATTRIBUTES) delete attributes[key];
		const kindTag = SPAN_KIND_TAGS[Number(hit.span_kind)];
		if (kindTag !== undefined) attributes['span.kind'] = kindTag;
		const statusMessage = statusMessageOf(hit.span_status);
		if (statusMessage !== null) attributes['otel.status_description'] = statusMessage;

		const endMicros = toMicros(hit.span_end_timestamp_nanos);
		spans.push({
			spanId,
			// Absent, not null, on a root — `skip_serializing_if` omits empty fields entirely.
			parentSpanId: asText(hit.parent_span_id, '') || null,
			name: asText(hit.span_name, '(unnamed)'),
			serviceName,
			// Rewritten below, once the trace's earliest span is known.
			startOffsetMicros: startMicros,
			// From the timestamps, not `span_duration_millis`, which floors a real 26us span to 0.
			durationMicros: endMicros !== null && endMicros > startMicros ? endMicros - startMicros : 0,
			isError: isErrorStatus(hit.span_status),
			attributes,
			resourceId,
			events: (Array.isArray(hit.events) ? hit.events : []).map((raw) => {
				const event = asRecord(raw);
				const eventMicros = toMicros(event['event_timestamp_nanos']);
				return {
					name: asText(event['event_name'], 'event'),
					timeOffsetMicros: eventMicros ?? startMicros,
					fields: flattenAttributes(asRecord(event['event_attributes']))
				};
			})
		});
	}

	if (spans.length === 0) return emptyTrace(response.num_hits > 0);

	// reduce, not Math.min(...spans): the span count is unbounded and a spread would overflow.
	const traceStartMicros = spans.reduce((min, s) => Math.min(min, s.startOffsetMicros), Infinity);
	for (const span of spans) {
		span.startOffsetMicros -= traceStartMicros;
		for (const event of span.events) event.timeOffsetMicros -= traceStartMicros;
	}

	return { traceStartMicros, resources, spans, truncated };
}
