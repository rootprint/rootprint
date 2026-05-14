import { formatFieldValue } from './field-resolver';

export function formatAsNdjson(logs: Record<string, unknown>[]): string {
	if (logs.length === 0) return '';
	return logs.map((log) => JSON.stringify(log)).join('\n');
}

const PRIORITY_FIELDS = ['timestamp', 'level', 'message'];
const CSV_QUOTE_RE = /["\n\r,]/;

function escapeCsvCell(value: string): string {
	if (CSV_QUOTE_RE.test(value)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

export function formatAsCsv(logs: Record<string, unknown>[]): string {
	if (logs.length === 0) return '';

	const fieldSet = new Set<string>();
	for (const log of logs) {
		for (const key of Object.keys(log)) {
			fieldSet.add(key);
		}
	}

	const priorityPresent = PRIORITY_FIELDS.filter((f) => fieldSet.has(f));
	const rest = [...fieldSet].filter((f) => !PRIORITY_FIELDS.includes(f)).sort();
	const headers = [...priorityPresent, ...rest];

	const lines = [headers.join(',')];
	for (const log of logs) {
		const row = headers.map((h) => escapeCsvCell(formatFieldValue(log[h])));
		lines.push(row.join(','));
	}
	return lines.join('\n');
}

export function formatAsText(
	logs: Record<string, unknown>[],
	timestampField: string,
	levelField: string,
	messageField: string
): string {
	if (logs.length === 0) return '';

	const excludeFields = new Set([timestampField, levelField, messageField]);

	return logs
		.map((log) => {
			const ts = log[timestampField] ?? '';
			const level = log[levelField] ?? 'unknown';
			const message = log[messageField] ?? '';

			const extras = Object.entries(log)
				.filter(([k]) => !excludeFields.has(k))
				.map(([k, v]) => `${k}=${formatFieldValue(v)}`)
				.join(' ');

			const parts = [formatFieldValue(ts), `[${formatFieldValue(level)}]`];
			if (extras) parts.push(extras);
			parts.push(formatFieldValue(message));
			return parts.join(' ');
		})
		.join('\n');
}
