import type { Filter } from '../../types.js';

const ESCAPE_TRIGGER_RE = /[\s:()[\]{}!+\-~^"\\*?/&|]/;

export function escapeFilterValue(value: string): string {
	if (ESCAPE_TRIGGER_RE.test(value)) {
		return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
	}
	return value;
}

/**
 * Combines the user's typed text query with structured filters into a single Quickwit query string.
 *
 * Same-field includes are OR-joined (a single log line has one `level`, so AND would never match);
 * excludes become `NOT field:"value"`; different fields and the text query are AND-joined.
 */
export function composeQuery(text: string, filters: Filter[]): string {
	const trimmed = text.trim();
	const hasText = trimmed !== '' && trimmed !== '*';
	if (filters.length === 0) return hasText ? text : '';

	const byField = new Map<string, { includes: string[]; excludes: string[] }>();
	for (const f of filters) {
		let entry = byField.get(f.field);
		if (!entry) {
			entry = { includes: [], excludes: [] };
			byField.set(f.field, entry);
		}
		if (f.exclude) entry.excludes.push(f.value);
		else entry.includes.push(f.value);
	}

	const clauses: string[] = [];
	for (const [field, { includes, excludes }] of byField) {
		if (includes.length === 1) {
			clauses.push(`${field}:${escapeFilterValue(includes[0])}`);
		} else if (includes.length > 1) {
			const or = includes.map((v) => `${field}:${escapeFilterValue(v)}`).join(' OR ');
			clauses.push(`(${or})`);
		}
		for (const v of excludes) {
			clauses.push(`NOT ${field}:${escapeFilterValue(v)}`);
		}
	}

	const joined = clauses.join(' AND ');
	return hasText ? `(${text}) AND ${joined}` : joined;
}
