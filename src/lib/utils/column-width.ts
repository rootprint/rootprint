import { formatFieldValue, resolveFieldValue } from './field-resolver';

const MAX_COLUMN_CH = 60;
const SAMPLE_SIZE = 20;

// Width of "YYYY-MM-DD HH:MM:SS.mmm" produced by formatTimestamp.
export const TIMESTAMP_COLUMN_WIDTH = 23;

export function computeColumnWidths(
	logs: Record<string, unknown>[],
	fields: string[]
): Record<string, number> {
	const widths: Record<string, number> = {};
	const sample = logs.slice(0, SAMPLE_SIZE);

	for (const field of fields) {
		let maxLen = 0;
		for (const log of sample) {
			const str = formatFieldValue(resolveFieldValue(log, field));
			if (str.length > maxLen) maxLen = str.length;
		}
		widths[field] = Math.min((maxLen || field.length) + 2, MAX_COLUMN_CH);
	}

	return widths;
}
