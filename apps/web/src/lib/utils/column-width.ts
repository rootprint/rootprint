import { getByPath } from './get-by-path';

const MAX_COLUMN_CH = 60;
const SAMPLE_SIZE = 20;

// Width of "YYYY-MM-DD HH:MM:SS.SSS" produced by formatLogRowTimestamp.
export const TIMESTAMP_COLUMN_WIDTH = 23;

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

// Widest message across all hits: the message is the only non-truncated column, so sizing it to the true max keeps every row's scroll width and separators aligned.
export function computeMessageWidth(logs: { message: string }[], label = 'message'): number {
	let maxLen = label.length;
	for (const log of logs) {
		const len = log.message?.length ?? 0;
		if (len > maxLen) maxLen = len;
	}
	return maxLen + 1;
}

export function buildGridTemplate(
	columns: string[],
	columnWidths: Record<string, number>,
	messageWidth: number
): string {
	const middle = columns.map((c) => `calc(${columnWidths[c] ?? c.length + 1}ch + 1rem)`).join(' ');
	// Trailing 1fr is an empty filler that stretches rows to the viewport edge
	// when content is narrower than the viewport.
	return `3px calc(${TIMESTAMP_COLUMN_WIDTH}ch + 1rem)${middle ? ' ' + middle : ''} calc(${messageWidth}ch + 1rem) 1fr`;
}
