import { QuickwitError, QuickwitErrorCode, type QuickwitClient } from 'quickwit-js';

import { logger } from '../lib/logger.js';
import type { TraceResponse, TraceSpan } from '../types.js';
import { translateQuickwitError } from '../lib/quickwit/errors.js';

export const NANOS_PER_MICRO = 1_000;
export const NANOS_PER_MILLI = 1_000_000;

export const TIMESTAMP_FIELD = 'span_start_timestamp_nanos';
export const DURATION_FIELD = 'span_duration_millis';
export const NAME_FIELD = 'span_name';
export const SERVICE_FIELD = 'service_name';
export const ERROR_SPANS = 'span_status.code:error';
export const ROOT_SPANS = 'is_root:true';

const MAX_TRACE_SPANS = 2_000;

const REDUNDANT_ATTRIBUTES = ['otel.status_code', 'error'];

export const SPAN_KIND_TAGS: Record<number, 'server' | 'client' | 'producer' | 'consumer'> = {
	2: 'server',
	3: 'client',
	4: 'producer',
	5: 'consumer'
};

/** `span_status` is `{code:"error"}` — a string, not the OTLP enum; `span_status.code:2` matches nothing. */
export const isErrorStatus = (status: unknown): boolean =>
	typeof status === 'object' &&
	status !== null &&
	String((status as { code?: unknown }).code ?? '').toLowerCase() === 'error';

const statusMessageOf = (status: unknown): string | null => {
	if (!isErrorStatus(status)) return null;
	const message = (status as { message?: unknown }).message;
	return typeof message === 'string' && message !== '' ? message : null;
};

function coerceStatus(raw: unknown): number | null {
	if (typeof raw !== 'number' && (typeof raw !== 'string' || raw === '')) return null;
	const status = Number(raw);
	return Number.isFinite(status) ? status : null;
}

/** Modern OTel SDKs emit `http.response.status_code`; older ones emit `http.status_code`. */
export function httpStatusOf(attributes: Record<string, unknown>): number | null {
	return (
		coerceStatus(attributes['http.response.status_code']) ??
		coerceStatus(attributes['http.status_code'])
	);
}

/** A missing span store reads as empty data instead of an error; `surface` names it in the log. */
export function orEmptyStore(traceIndexId: string, surface: string) {
	return (err: unknown): null => {
		if (err instanceof QuickwitError && err.code === QuickwitErrorCode.NOT_FOUND) {
			logger.warn({ traceIndexId }, `span store not found — ${surface} will read as empty`);
			return null;
		}
		return translateQuickwitError(err);
	};
}

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

export const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

/** Includes the service: Quickwit moves `service.name` out of `resource_attributes` at ingest. */
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
	scope_name?: unknown;
	scope_version?: unknown;
	span_start_timestamp_nanos?: unknown;
	span_end_timestamp_nanos?: unknown;
	span_status?: unknown;
	span_attributes?: unknown;
	resource_attributes?: unknown;
	events?: unknown;
}

const toMicros = (v: unknown): number | null =>
	typeof v === 'number' && Number.isFinite(v) ? Math.round(v / NANOS_PER_MICRO) : null;

export const asText = (v: unknown, fallback: string): string =>
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
	const builder = idx
		.query(`trace_id:${traceId}`)
		.sortBy('span_start_timestamp_nanos', 'asc')
		.limit(MAX_TRACE_SPANS);
	const response = await idx
		.search<RawSpanHit>(builder)
		.catch(orEmptyStore(traceIndexId, 'every trace'));
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
		// Both restate `isError`; the status message survives as `otel.status_description`.
		for (const key of REDUNDANT_ATTRIBUTES) delete attributes[key];
		const kindTag = SPAN_KIND_TAGS[Number(hit.span_kind)];
		if (kindTag !== undefined) attributes['span.kind'] = kindTag;
		const statusMessage = statusMessageOf(hit.span_status);
		if (statusMessage !== null) attributes['otel.status_description'] = statusMessage;
		const scopeName = asText(hit.scope_name, '');
		if (scopeName !== '') attributes['otel.scope.name'] = scopeName;
		const scopeVersion = asText(hit.scope_version, '');
		if (scopeVersion !== '') attributes['otel.scope.version'] = scopeVersion;

		const endMicros = toMicros(hit.span_end_timestamp_nanos);
		spans.push({
			spanId,
			parentSpanId: asText(hit.parent_span_id, '') || null,
			name: asText(hit.span_name, '(unnamed)'),
			serviceName,
			// Absolute until rebased below.
			startOffsetMicros: startMicros,
			// Not `span_duration_millis`: it floors sub-millisecond spans to 0.
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

	if (spans.length === 0) return emptyTrace(true);

	// Relies on the ascending sort above.
	const traceStartMicros = spans[0].startOffsetMicros;
	for (const span of spans) {
		span.startOffsetMicros -= traceStartMicros;
		for (const event of span.events) event.timeOffsetMicros -= traceStartMicros;
	}

	return { traceStartMicros, resources, spans, truncated };
}
