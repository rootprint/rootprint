import { QuickwitError, QuickwitErrorCode } from '@rootprint-io/quickwit-js';

import { logger } from '../logger.js';
import { translateQuickwitError } from './errors.js';

export const NANOS_PER_MICRO = 1_000;
export const NANOS_PER_MILLI = 1_000_000;

export const TIMESTAMP_FIELD = 'span_start_timestamp_nanos';
export const DURATION_FIELD = 'span_duration_millis';
export const NAME_FIELD = 'span_name';
export const SERVICE_FIELD = 'service_name';
export const ERROR_SPANS = 'span_status.code:error';
export const ROOT_SPANS = 'is_root:true';

/**
 * One span per request a service handles: an inbound call (SERVER, 2), a consumed message
 * (CONSUMER, 5), or a trace the service starts itself (root).
 */
export const ENTRY_SPANS = `(span_kind:IN [2 5] OR ${ROOT_SPANS})`;

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
			logger.warn(
				{ 'rootprint.index.id': traceIndexId },
				`span store not found — ${surface} will read as empty`
			);
			return null;
		}
		return translateQuickwitError(err);
	};
}

export const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

export const asText = (v: unknown, fallback: string): string =>
	typeof v === 'string' && v !== '' ? v : fallback;
