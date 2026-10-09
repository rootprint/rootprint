import { format, formatDistanceToNow, getUnixTime, isValid, parse, parseISO } from 'date-fns';

/** "YYYY-MM-DD HH:MM:SS.SSS" from an ISO string or epoch milliseconds — log and span timestamps. */
export function formatTimestamp(input: string | number): string {
	const d = typeof input === 'string' ? parseISO(input) : new Date(input);
	return isValid(d) ? format(d, 'yyyy-MM-dd HH:mm:ss.SSS') : '—';
}

/** "YYYY-MM-DD HH:MM:SS" — second precision, used in the activity tables. */
export function formatActivityTimestamp(iso: string): string {
	const d = parseISO(iso);
	return isValid(d) ? format(d, 'yyyy-MM-dd HH:mm:ss') : '—';
}

export function formatRelativeTime(input: string | Date): string {
	const d = typeof input === 'string' ? parseISO(input) : input;
	if (!isValid(d)) return '—';
	return formatDistanceToNow(d, { addSuffix: true });
}

const AGE_UNITS = [
	['y', 365 * 86_400],
	['mo', 30 * 86_400],
	['d', 86_400],
	['h', 3600],
	['m', 60]
] as const;

/** "just now", "4m ago", "in 6mo" — compact for dense tables. */
export function formatAge(input: Date): string {
	const seconds = (Date.now() - input.getTime()) / 1000;
	const abs = Math.abs(seconds);
	const unit = AGE_UNITS.find(([, size]) => abs >= size);
	if (!unit) return 'just now';
	const n = `${Math.floor(abs / unit[1])}${unit[0]}`;
	return seconds < 0 ? `in ${n}` : `${n} ago`;
}

/** "June 10, 2026" — locale-aware, date only. */
export function formatDate(input: string | Date): string {
	const d = typeof input === 'string' ? parseISO(input) : input;
	if (!isValid(d)) return '—';
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** "YYYY-MM-DD HH:MM" */
export function formatDateTime(input: string | Date): string {
	const d = typeof input === 'string' ? parseISO(input) : input;
	return isValid(d) ? format(d, 'yyyy-MM-dd HH:mm') : '—';
}

export function parseLocalDateTime(dateStr: string, timeStr: string): number | null {
	const d = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
	return isValid(d) ? getUnixTime(d) : null;
}

export function formatTickDate(d: Date | number, spanMs: number): string {
	const oneDay = 24 * 60 * 60 * 1000;
	return spanMs <= oneDay ? format(d, 'HH:mm') : format(d, 'MM-dd HH:mm');
}

export function formatTooltipDate(d: Date | number): string {
	return format(d, 'yyyy-MM-dd HH:mm:ss');
}
