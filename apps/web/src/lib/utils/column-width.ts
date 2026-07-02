import { getByPath } from './get-by-path';

const MAX_COLUMN_CH = 60;
const SAMPLE_SIZE = 20;

// Width of "YYYY-MM-DD HH:MM:SS.SSS" produced by formatLogRowTimestamp.
const TIMESTAMP_COLUMN_WIDTH = 23;

export function formatCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	try {
		return JSON.stringify(value);
	} catch {
		return '';
	}
}

export function computeColumnWidths(
	logs: Record<string, unknown>[],
	fields: string[]
): Record<string, number> {
	const widths: Record<string, number> = {};
	const sample = logs.slice(0, SAMPLE_SIZE);

	for (const field of fields) {
		let maxLen = 0;
		for (const log of sample) {
			const str = formatCell(getByPath(log, field));
			if (str.length > maxLen) maxLen = str.length;
		}
		widths[field] = Math.min(Math.max(maxLen, field.length) + 1, MAX_COLUMN_CH);
	}

	return widths;
}

export function computeFieldWidth(logs: Record<string, unknown>[], field: string): number {
	let maxLen = field.length;
	for (const log of logs) {
		const len = formatCell(getByPath(log, field)).length;
		if (len > maxLen) maxLen = len;
	}
	return maxLen + 1;
}

export function buildGridTemplate(
	columns: string[],
	columnWidths: Record<string, number>,
	wideField: string | undefined,
	wideWidth: number,
	lineWrap = false
): string {
	const prefix = `3px calc(${TIMESTAMP_COLUMN_WIDTH}ch + 1rem)`;
	if (columns.length === 0) return `${prefix} ${lineWrap ? 'minmax(0, 1fr)' : '1fr'}`;
	const tracks = columns
		.map((c) => {
			if (c === wideField) return lineWrap ? 'minmax(0, 1fr)' : `calc(${wideWidth}ch + 1rem)`;
			return `calc(${columnWidths[c] ?? c.length + 1}ch + 1rem)`;
		})
		.join(' ');
	return lineWrap ? `${prefix} ${tracks}` : `${prefix} ${tracks} 1fr`;
}
