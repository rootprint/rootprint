import { resolveFieldValue } from '$lib/utils/field-resolver';
import { formatTimestamp, normalizeToMs } from '$lib/utils/time';
import type { TimezoneMode } from '$lib/types';

export const SEVERITY_ORDER = [
	'trace',
	'debug',
	'info',
	'warn',
	'warning',
	'error',
	'critical',
	'fatal'
] as const;

export function sortBySeverity(values: string[]): string[] {
	const orderMap: Map<string, number> = new Map(SEVERITY_ORDER.map((v, i) => [v, i]));
	return [...values].sort((a, b) => {
		const ai = orderMap.get(a.toLowerCase()) ?? SEVERITY_ORDER.length;
		const bi = orderMap.get(b.toLowerCase()) ?? SEVERITY_ORDER.length;
		return ai - bi;
	});
}

export function extractSeverity(doc: Record<string, unknown>, levelField: string): string {
	const raw = resolveFieldValue(doc, levelField);
	return (raw == null ? 'unknown' : String(raw)).toLowerCase();
}

export function severityBorderColor(severity: string): string {
	switch (severity) {
		case 'error':
			return 'border-l-level-error';
		case 'fatal':
		case 'critical':
			return 'border-l-level-critical';
		case 'warn':
		case 'warning':
			return 'border-l-level-warning';
		case 'debug':
		case 'trace':
			return 'border-l-level-debug';
		case 'info':
			return 'border-l-level-info';
		default:
			return 'border-l-level-unknown/30';
	}
}

export function severityBgColor(severity: string): string {
	switch (severity) {
		case 'error':
			return 'bg-level-error/5';
		case 'fatal':
		case 'critical':
			return 'bg-level-critical/5';
		case 'warn':
		case 'warning':
			return 'bg-level-warning/5';
		case 'debug':
		case 'trace':
			return 'bg-level-debug/5';
		case 'info':
			return 'bg-level-info/5';
		default:
			return '';
	}
}

export function severityDotColor(severity: string): string | null {
	switch (severity) {
		case 'error':
			return 'bg-level-error';
		case 'fatal':
		case 'critical':
			return 'bg-level-critical';
		case 'warn':
		case 'warning':
			return 'bg-level-warning';
		case 'debug':
		case 'trace':
			return 'bg-level-debug';
		case 'info':
			return 'bg-level-info';
		default:
			return null;
	}
}

export function severityTextColor(severity: string): string {
	switch (severity) {
		case 'error':
			return 'text-level-error';
		case 'fatal':
		case 'critical':
			return 'text-level-critical';
		case 'warn':
		case 'warning':
			return 'text-level-warning';
		case 'debug':
		case 'trace':
			return 'text-level-debug';
		case 'info':
			return 'text-level-info';
		default:
			return 'text-level-unknown/60';
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
