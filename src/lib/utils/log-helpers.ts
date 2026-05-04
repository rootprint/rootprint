import { LEVEL_TOKEN_MAP, SEVERITY_ORDER } from '$lib/constants/severity';
import type { LogEntry, TimezoneMode } from '$lib/types';
import { resolveFieldValue } from '$lib/utils/field-resolver';
import { formatTimestamp, normalizeToMs } from '$lib/utils/time';

export function createLogKeyer() {
	let nextKey = 0;
	return (hits: Record<string, unknown>[]): LogEntry[] =>
		hits.map((hit) => ({ key: nextKey++, hit }));
}

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

const SEVERITY_ORDER_INDEX = new Map<string, number>(SEVERITY_ORDER.map((v, i) => [v, i]));

export function sortBySeverity(values: string[]): string[] {
	return [...values].sort((a, b) => {
		const ai = SEVERITY_ORDER_INDEX.get(a.toLowerCase()) ?? SEVERITY_ORDER.length;
		const bi = SEVERITY_ORDER_INDEX.get(b.toLowerCase()) ?? SEVERITY_ORDER.length;
		return ai - bi;
	});
}

export function extractSeverity(doc: Record<string, unknown>, levelField: string): string {
	const raw = resolveFieldValue(doc, levelField);
	return (raw == null ? 'unknown' : String(raw)).toLowerCase();
}

type SeverityStyle = { border: string; dot: string | null; chip: string };

function levelStyle(token: string): SeverityStyle {
	return {
		border: `border-l-level-${token}`,
		dot: `bg-level-${token}`,
		chip: `bg-level-${token}/15 text-level-${token}`
	};
}

const SEVERITY_STYLES: Record<string, SeverityStyle> = {
	error: levelStyle('error'),
	critical: levelStyle('critical'),
	warning: levelStyle('warning'),
	debug: levelStyle('debug'),
	info: levelStyle('info')
};

const SEVERITY_FALLBACK: SeverityStyle = {
	border: 'border-l-level-unknown/30',
	dot: null,
	chip: 'bg-level-unknown/15 text-level-unknown'
};

function severityStyle(severity: string): SeverityStyle {
	const canonical = LEVEL_TOKEN_MAP[severity] ?? severity;
	return SEVERITY_STYLES[canonical] ?? SEVERITY_FALLBACK;
}

export function severityBorderColor(severity: string): string {
	return severityStyle(severity).border;
}

export function severityDotColor(severity: string): string | null {
	return severityStyle(severity).dot;
}

export function severityChipTint(severity: string): string {
	return severityStyle(severity).chip;
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

function walkFlatten(obj: Record<string, unknown>, prefix: string, out: [string, unknown][]): void {
	for (const key of Object.keys(obj)) {
		const value = obj[key];
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			walkFlatten(value as Record<string, unknown>, fullKey, out);
		} else {
			out.push([fullKey, value]);
		}
	}
}

export function flattenObject(obj: Record<string, unknown>, prefix = ''): [string, unknown][] {
	const result: [string, unknown][] = [];
	walkFlatten(obj, prefix, result);
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

const TRACE_ID_FIELDS = ['trace_id', 'attributes.trace_id'] as const;

export function extractTraceId(
	hit: Record<string, unknown>
): { field: string; value: string } | null {
	for (const field of TRACE_ID_FIELDS) {
		const raw = resolveFieldValue(hit, field);
		if (typeof raw === 'string' && raw.length > 0) {
			return { field, value: raw };
		}
	}
	return null;
}
