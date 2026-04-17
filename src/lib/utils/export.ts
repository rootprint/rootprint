export function formatAsNdjson(logs: Record<string, unknown>[]): string {
	if (logs.length === 0) return '';
	return logs.map((log) => JSON.stringify(log)).join('\n');
}

const PRIORITY_FIELDS = ['timestamp', 'level', 'message'];

function escapeCsvCell(value: string): string {
	if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

function cellValue(value: unknown): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}

export function formatAsCsv(logs: Record<string, unknown>[]): string {
	if (logs.length === 0) return '';

	// Collect union of all fields
	const fieldSet = new Set<string>();
	for (const log of logs) {
		for (const key of Object.keys(log)) {
			fieldSet.add(key);
		}
	}

	// Priority fields first, then remaining alphabetical
	const priorityPresent = PRIORITY_FIELDS.filter((f) => fieldSet.has(f));
	const rest = [...fieldSet].filter((f) => !PRIORITY_FIELDS.includes(f)).sort();
	const headers = [...priorityPresent, ...rest];

	const lines = [headers.join(',')];
	for (const log of logs) {
		const row = headers.map((h) => escapeCsvCell(cellValue(log[h])));
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
				.map(([k, v]) => `${k}=${cellValue(v)}`)
				.join(' ');

			const parts = [cellValue(ts), `[${cellValue(level)}]`];
			if (extras) parts.push(extras);
			parts.push(cellValue(message));
			return parts.join(' ');
		})
		.join('\n');
}
