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
