import { formatFieldValue, resolveFieldValue } from './field-resolver';
import { extractTimestamp } from './log-helpers';

const MAX_COLUMN_CH = 60;
const SAMPLE_SIZE = 20;

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

export function computeTimestampWidth(
	logs: Record<string, unknown>[],
	timestampField: string,
	timezoneMode: 'utc' | 'local'
): number {
	const sample = logs.slice(0, SAMPLE_SIZE);
	let maxLen = 0;
	for (const log of sample) {
		const str = extractTimestamp(log, timestampField, timezoneMode);
		if (str.length > maxLen) maxLen = str.length;
	}
	return maxLen;
}
