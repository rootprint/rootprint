import { format, formatDistanceToNow, getUnixTime, isValid, parse, parseISO } from 'date-fns';

/** "HH:MM" */
export function formatChartTime(tsSec: number): string {
	return format(tsSec * 1000, 'HH:mm');
}

/** "MM-DD HH:MM" */
export function formatChartDate(tsSec: number): string {
	return format(tsSec * 1000, 'MM-dd HH:mm');
}

/** "YYYY-MM-DD HH:MM:SS" */
export function formatChartTooltip(tsSec: number): string {
	return format(tsSec * 1000, 'yyyy-MM-dd HH:mm:ss');
}

/** "YYYY-MM-DD HH:MM:SS.SSS" — used in the log row timestamp column. */
export function formatLogRowTimestamp(iso: string): string {
	const d = parseISO(iso);
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

/** "Jun 10, 2026, 3:45 PM" — locale-aware date + time. */
export function formatDateTime(input: string | Date): string {
	const d = typeof input === 'string' ? parseISO(input) : input;
	if (!isValid(d)) return '—';
	return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function parseLocalDateTime(dateStr: string, timeStr: string): number | null {
	const d = parse(`${dateStr} ${timeStr}`, 'yyyy-MM-dd HH:mm', new Date());
	return isValid(d) ? getUnixTime(d) : null;
}

export function formatTickDate(d: Date | number, spanMs: number): string {
	const date = d instanceof Date ? d : new Date(d);
	const oneDay = 24 * 60 * 60 * 1000;
	return spanMs <= oneDay ? format(date, 'HH:mm') : format(date, 'MMM d');
}

export function formatTooltipDate(d: Date | number): string {
	const date = d instanceof Date ? d : new Date(d);
	return format(date, 'yyyy-MM-dd HH:mm');
}
