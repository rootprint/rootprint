import { LEVEL_TOKEN_MAP, SEVERITY_ORDER } from '$lib/constants/severity';
import type { TimezoneMode } from '$lib/types';
import { resolveFieldValue } from '$lib/utils/field-resolver';
import { formatTimestamp, normalizeToMs } from '$lib/utils/time';

export function getLevelColor(level: string): string {
	if (typeof document === 'undefined') return '';
	const style = getComputedStyle(document.documentElement);
	const normalized = level.toLowerCase();
	const token = LEVEL_TOKEN_MAP[normalized] ?? normalized;
	return (
		style.getPropertyValue(`--level-${token}`).trim() ||
		style.getPropertyValue('--level-unknown').trim()
	);
}

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

export function severityChipTint(severity: string): string {
	switch (severity) {
		case 'error':
			return 'bg-level-error/15 text-level-error';
		case 'fatal':
		case 'critical':
			return 'bg-level-critical/15 text-level-critical';
		case 'warn':
		case 'warning':
			return 'bg-level-warning/15 text-level-warning';
		case 'debug':
		case 'trace':
			return 'bg-level-debug/15 text-level-debug';
		case 'info':
			return 'bg-level-info/15 text-level-info';
		default:
			return 'bg-level-unknown/15 text-level-unknown';
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

	if (Number.isNaN(ms)) return String(raw);
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

export function isEmpty(value: unknown): boolean {
	if (value == null) return true;
	if (value === '') return true;
	if (Array.isArray(value) && value.length === 0) return true;
	if (
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.keys(value as object).length === 0
	)
		return true;
	return false;
}
