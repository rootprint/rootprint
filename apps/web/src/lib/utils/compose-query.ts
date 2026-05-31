import type { Filter } from '$lib/types';

const ESCAPE_TRIGGER_RE = /[\s:()[\]{}!+\-~^"\\*?/&|]/;

/**
 * Wrap a Quickwit filter value in double quotes when it contains characters the
 * search grammar would otherwise interpret as operators, and escape any
 * backslashes and interior quotes. Returns the value unchanged when no escaping
 * is needed.
 */
export function escapeFilterValue(value: string): string {
	if (ESCAPE_TRIGGER_RE.test(value)) {
		return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
	}
	return value;
}

/**
 * Combines the user's typed text query with structured filters into a single
 * Quickwit query string.
 *
 * Semantics:
 * - Multiple include filters on the same field are OR-joined: `level:"info" OR
 *   level:"warn"`. A single log line can only have one `level`, so AND would
 *   never match.
 * - Exclude filters become `NOT field:"value"` and are AND-joined with the rest.
 * - Different fields are AND-joined.
 * - The user's text query (when present and not `*`) is wrapped in parens and
 *   AND-joined with the filters.
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
