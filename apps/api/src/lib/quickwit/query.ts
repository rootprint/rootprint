import type { Filter } from '../../types.js';

// `<`, `>` and `=` are range operators to Quickwit's parser; a JVM `Foo.<init>` span name hits them.
const ESCAPE_TRIGGER_RE = /[\s:()[\]{}!+\-~^"\\*?/&|<>=]/;

// What Quickwit's grammar reads as syntax inside a field name; escaped, they match the literal key.
const FIELD_SPECIAL_RE = /[\s:()[\]{}'"!+^*`\\]/g;
// No escape makes these match: a leading `-` reads as negation, a key holding `\` parses but never
// matches, and whitespace other than a space or tab is untested.
const UNQUERYABLE_FIELD_RE = /^-|\\|[^\S \t]/;

/** Whether a composed `field:value` clause can match that literal key. */
export function isQueryableField(field: string): boolean {
	return !UNQUERYABLE_FIELD_RE.test(field);
}

export function escapeFilterValue(value: string): string {
	if (ESCAPE_TRIGGER_RE.test(value)) {
		return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
	}
	return value;
}

function fieldTerm(field: string, value: string): string {
	return `${field.replace(FIELD_SPECIAL_RE, '\\$&')}:${escapeFilterValue(value)}`;
}

/** Composes free text + filters into a runnable Quickwit query; empty input yields `*` (match-all). */
export function composeQuery(text: string, filters: Filter[]): string {
	const trimmed = text.trim();
	const hasText = trimmed !== '' && trimmed !== '*';
	if (filters.length === 0) return hasText ? text : '*';

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
			clauses.push(fieldTerm(field, includes[0]));
		} else if (includes.length > 1) {
			const or = includes.map((v) => fieldTerm(field, v)).join(' OR ');
			clauses.push(`(${or})`);
		}
		for (const v of excludes) {
			clauses.push(`NOT ${fieldTerm(field, v)}`);
		}
	}

	const joined = clauses.join(' AND ');
	return hasText ? `(${text}) AND ${joined}` : joined;
}
