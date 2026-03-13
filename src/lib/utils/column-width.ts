import { resolveFieldValue, formatFieldValue } from './field-resolver';

export const MAX_COLUMN_CH = 60;

export function computeColumnWidths(
	logs: Record<string, unknown>[],
	fields: string[],
	prevMaxWidths: Record<string, number>
): { widths: Record<string, number>; maxRawWidths: Record<string, number> } {
	const maxRawWidths = { ...prevMaxWidths };

	for (const field of fields) {
		if (!(field in maxRawWidths)) maxRawWidths[field] = 0;
		for (const log of logs) {
			const str = formatFieldValue(resolveFieldValue(log, field));
			if (str) {
				maxRawWidths[field] = Math.max(maxRawWidths[field], str.length);
			}
		}
	}

	const widths: Record<string, number> = {};
	for (const field of fields) {
		widths[field] = Math.min((maxRawWidths[field] ?? field.length) + 2, MAX_COLUMN_CH);
	}

	return { widths, maxRawWidths };
}
