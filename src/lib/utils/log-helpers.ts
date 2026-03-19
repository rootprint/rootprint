import { resolveFieldValue, formatFieldValue } from '$lib/utils/field-resolver';
import { formatTimestamp, normalizeToMs } from '$lib/utils/time';
import type { TimezoneMode } from '$lib/types';

export function extractSeverity(doc: Record<string, unknown>, levelField: string): string {
	const raw = resolveFieldValue(doc, levelField);
	return (raw != null ? String(raw) : 'unknown').toLowerCase();
}

export function severityBorderColor(severity: string): string {
	switch (severity) {
		case 'error':
		case 'fatal':
		case 'critical':
			return 'border-l-error';
		case 'warn':
		case 'warning':
			return 'border-l-warning';
		case 'debug':
		case 'trace':
			return 'border-l-accent';
		case 'info':
			return 'border-l-info';
		default:
			return 'border-l-base-content/30';
	}
}

export function severityTextColor(severity: string): string {
	switch (severity) {
		case 'error':
		case 'fatal':
		case 'critical':
			return 'text-error';
		case 'warn':
		case 'warning':
			return 'text-warning';
		case 'debug':
		case 'trace':
			return 'text-accent';
		case 'info':
			return 'text-info';
		default:
			return 'text-base-content/60';
	}
}

export function extractTimestamp(
	doc: Record<string, unknown>,
	timestampField: string,
	timezoneMode: TimezoneMode
): string {
	const raw = resolveFieldValue(doc, timestampField);
	if (raw == null) return '';

	const ms = typeof raw === 'number' ? normalizeToMs(raw) : new Date(raw as string).getTime();

	if (isNaN(ms)) return String(raw);
	return formatTimestamp(ms, timezoneMode);
}

export function flattenObject(obj: Record<string, unknown>, prefix = ''): [string, unknown][] {
	const result: [string, unknown][] = [];
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			result.push(...flattenObject(value as Record<string, unknown>, fullKey));
		} else {
			result.push([fullKey, value]);
		}
	}
	return result;
}
