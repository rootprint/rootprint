import type { FieldConfig, LogHit } from '$lib/types';
import { getByPath } from './get-by-path';

export function normalizeHit(raw: Record<string, unknown>, index: number, fc: FieldConfig): LogHit {
	return {
		key: String(index),
		timestamp: coerceIso(getByPath(raw, fc.timestampField)),
		level: String(getByPath(raw, fc.levelField) ?? '').toLowerCase(),
		message: String(getByPath(raw, fc.messageField) ?? ''),
		raw
	};
}

function coerceIso(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') {
		// > 1e15 is physically impossible as milliseconds-since-epoch (year 33658+),
		// so treat values above that as nanoseconds (Quickwit's _otel_timestamp_ns_int).
		const ms = value > 1e15 ? Math.floor(value / 1e6) : value;
		if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return '';
		return new Date(ms).toISOString();
	}
	return '';
}
