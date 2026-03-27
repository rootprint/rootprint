import type { Clause } from '$lib/types';

export function escapeFilterValue(value: string): string {
	if (/[\s:()[\]{}!+\-~^"\\*?/&|]/.test(value)) {
		return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
	}
	return value;
}

// --- Internal helpers ---

type ClauseMatch = {
	field: string;
	exclude: boolean;
	start: number;
	end: number;
	kind: 'single' | 'group';
	value?: string;
	rawValue?: string;
	values?: string[];
};

function isWhitespace(ch: string): boolean {
	return /\s/.test(ch);
}

function isFieldStartChar(ch: string): boolean {
	return /[@$_A-Za-z-]/.test(ch);
}

function isFieldBodyChar(ch: string): boolean {
	return /[@$_/.A-Za-z0-9-]/.test(ch);
}

function unquote(raw: string): string {
	return raw.replaceAll('\\"', '"').replaceAll('\\\\', '\\');
}

function parseQuotedValueAt(
	input: string,
	start: number
): { value: string; raw: string; end: number } | null {
	if (input[start] !== '"') return null;

	let i = start + 1;
	while (i < input.length) {
		const ch = input[i];
		if (ch === '\\') {
			i += 2;
			continue;
		}
		if (ch === '"') {
			const raw = input.slice(start, i + 1);
			const inner = input.slice(start + 1, i);
			return { value: unquote(inner), raw, end: i + 1 };
		}
		i++;
	}

	return null;
}

function parseParenthesizedValueAt(
	input: string,
	start: number
): { inner: string; end: number } | null {
	if (input[start] !== '(') return null;

	let depth = 0;
	let inQuote = false;
	let i = start;

	while (i < input.length) {
		const ch = input[i];

		if (inQuote) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === '"') {
				inQuote = false;
			}
			i++;
			continue;
		}

		if (ch === '"') {
			inQuote = true;
			i++;
			continue;
		}

		if (ch === '(') {
			depth++;
			i++;
			continue;
		}

		if (ch === ')') {
			depth--;
			i++;
			if (depth === 0) {
				return { inner: input.slice(start + 1, i - 1), end: i };
			}
			continue;
		}

		i++;
	}

	return null;
}

function parseGroupValueToken(rawToken: string): string | null {
	const token = rawToken.trim();
	if (!token) return null;

	if (token.startsWith('"')) {
		const quoted = parseQuotedValueAt(token, 0);
		if (!quoted || quoted.end !== token.length) return null;
		return quoted.value;
	}

	if (isWhitespace(token)) return null;
	if (token.startsWith('[') || token.startsWith('{')) return null;
	if (token.includes(':')) return null;

	return token;
}

function splitOrGroup(inner: string): string[] | null {
	// Quote-aware split on ' OR '. Reject advanced group syntax.
	const values: string[] = [];
	let current = '';
	let inQuote = false;
	let i = 0;

	while (i < inner.length) {
		const ch = inner[i];

		if (inQuote) {
			if (ch === '\\') {
				if (i + 1 >= inner.length) return null;
				current += ch + inner[i + 1];
				i += 2;
				continue;
			}
			if (ch === '"') inQuote = false;
			current += ch;
			i++;
			continue;
		}

		if (ch === '"') {
			inQuote = true;
			current += ch;
			i++;
			continue;
		}

		if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}') {
			return null;
		}

		if (inner.slice(i, i + 5).toUpperCase() === ' AND ') {
			return null;
		}

		if (inner.slice(i, i + 4).toUpperCase() === ' OR ') {
			const parsed = parseGroupValueToken(current);
			if (parsed === null) return null;
			values.push(parsed);
			current = '';
			i += 4;
			continue;
		}

		current += ch;
		i++;
	}

	if (inQuote) return null;

	const parsed = parseGroupValueToken(current);
	if (parsed === null) return null;
	values.push(parsed);

	return values;
}

function parsePlainValueAt(
	input: string,
	start: number
): { value: string; raw: string; end: number } | null {
	let i = start;
	while (i < input.length && !isWhitespace(input[i])) i++;
	if (i === start) return null;

	const raw = input.slice(start, i);
	if (raw.startsWith('[') || raw.startsWith('{')) return null;
	if (raw.includes(':')) return null;

	return { value: raw, raw, end: i };
}

function hasUnaryNotBefore(input: string, clauseStart: number): boolean {
	let i = clauseStart - 1;
	while (i >= 0 && isWhitespace(input[i])) i--;
	if (i < 0) return false;

	const tokenEnd = i + 1;
	while (i >= 0 && /[A-Za-z]/.test(input[i])) i--;
	const token = input.slice(i + 1, tokenEnd);
	if (token.toUpperCase() !== 'NOT') return false;

	const before = i >= 0 ? input[i] : '';
	return i < 0 || isWhitespace(before) || before === '(';
}

function parseClauseAt(input: string, start: number): ClauseMatch | null {
	let i = start;
	let exclude = false;

	if (input[i] === '-') {
		exclude = true;
		i++;
	}

	const fieldStart = i;
	if (i >= input.length || !isFieldStartChar(input[i])) return null;
	i++;
	while (i < input.length && isFieldBodyChar(input[i])) i++;
	if (i === fieldStart || input[i] !== ':') return null;

	const field = input.slice(fieldStart, i);
	i++;
	if (i >= input.length) return null;

	let match: ClauseMatch | null = null;

	if (input[i] === '"') {
		const quoted = parseQuotedValueAt(input, i);
		if (!quoted) return null;
		match = {
			field,
			exclude,
			start,
			end: quoted.end,
			kind: 'single',
			value: quoted.value,
			rawValue: quoted.raw
		};
	} else if (input[i] === '(') {
		const group = parseParenthesizedValueAt(input, i);
		if (!group) return null;
		const values = splitOrGroup(group.inner);
		if (!values || values.length === 0) return null;
		match = { field, exclude, start, end: group.end, kind: 'group', values };
	} else {
		const plain = parsePlainValueAt(input, i);
		if (!plain) return null;
		match = {
			field,
			exclude,
			start,
			end: plain.end,
			kind: 'single',
			value: plain.value,
			rawValue: plain.raw
		};
	}

	if (match.end < input.length && !isWhitespace(input[match.end])) {
		return null;
	}

	if (hasUnaryNotBefore(input, match.start)) {
		return null;
	}

	return match;
}

function parseClauseMatches(query: string): ClauseMatch[] {
	const matches: ClauseMatch[] = [];

	let inQuote = false;
	let parenDepth = 0;
	let bracketDepth = 0;
	let braceDepth = 0;
	let i = 0;

	while (i < query.length) {
		const ch = query[i];

		if (inQuote) {
			if (ch === '\\') {
				i += 2;
				continue;
			}
			if (ch === '"') {
				inQuote = false;
			}
			i++;
			continue;
		}

		if (ch === '"') {
			inQuote = true;
			i++;
			continue;
		}

		if (ch === '(') {
			parenDepth++;
			i++;
			continue;
		}

		if (ch === ')') {
			if (parenDepth > 0) parenDepth--;
			i++;
			continue;
		}

		if (ch === '[') {
			bracketDepth++;
			i++;
			continue;
		}

		if (ch === ']') {
			if (bracketDepth > 0) bracketDepth--;
			i++;
			continue;
		}

		if (ch === '{') {
			braceDepth++;
			i++;
			continue;
		}

		if (ch === '}') {
			if (braceDepth > 0) braceDepth--;
			i++;
			continue;
		}

		const isTopLevel = parenDepth === 0 && bracketDepth === 0 && braceDepth === 0;
		const hasBoundaryBefore = i === 0 || isWhitespace(query[i - 1]);

		if (isTopLevel && hasBoundaryBefore) {
			const match = parseClauseAt(query, i);
			if (match) {
				matches.push(match);
				i = match.end;
				continue;
			}
		}

		i++;
	}

	return matches;
}

// --- Public API ---

export function parseClauses(query: string): Clause[] {
	const clauses: Clause[] = [];

	for (const match of parseClauseMatches(query)) {
		if (match.kind === 'group') {
			for (const value of match.values ?? []) {
				clauses.push({ field: match.field, value, exclude: match.exclude });
			}
		} else if (match.value !== undefined) {
			clauses.push({ field: match.field, value: match.value, exclude: match.exclude });
		}
	}

	return clauses;
}

export function hasClause(query: string, field: string, value: string, exclude = false): boolean {
	return parseClauses(query).some(
		(c) => c.field === field && c.value === value && c.exclude === exclude
	);
}

export function addClause(query: string, field: string, value: string, exclude = false): string {
	if (hasClause(query, field, value, exclude)) return query;

	// Remove from opposite polarity if present
	if (hasClause(query, field, value, !exclude)) {
		query = removeClause(query, field, value, !exclude);
	}

	const escaped = escapeFilterValue(value);
	const prefix = exclude ? '-' : '';

	// Check if same field+polarity already has a quick-filter clause — merge into OR group
	for (const match of parseClauseMatches(query)) {
		if (match.field !== field || match.exclude !== exclude) continue;

		if (match.kind === 'group') {
			const nextValues = [...(match.values ?? []), value];
			const replacement = `${prefix}${field}:(${nextValues.map(escapeFilterValue).join(' OR ')})`;
			return query.slice(0, match.start) + replacement + query.slice(match.end);
		}

		if (match.value !== undefined) {
			const existing = match.rawValue ?? escapeFilterValue(match.value);
			const replacement = `${prefix}${field}:(${existing} OR ${escaped})`;
			return query.slice(0, match.start) + replacement + query.slice(match.end);
		}
	}

	// No existing clause for this field — append
	const clause = `${prefix}${field}:${escaped}`;
	return query ? `${query} ${clause}` : clause;
}

export function removeClause(query: string, field: string, value: string, exclude = false): string {
	for (const match of parseClauseMatches(query)) {
		if (match.field !== field || match.exclude !== exclude) continue;

		if (match.kind === 'group') {
			const values = [...(match.values ?? [])];
			const idx = values.indexOf(value);
			if (idx === -1) continue;

			values.splice(idx, 1);
			if (values.length === 0) {
				return cleanWhitespace(query.slice(0, match.start) + query.slice(match.end));
			}

			const prefix = exclude ? '-' : '';
			if (values.length === 1) {
				const replacement = `${prefix}${field}:${escapeFilterValue(values[0])}`;
				return cleanWhitespace(query.slice(0, match.start) + replacement + query.slice(match.end));
			}

			const replacement = `${prefix}${field}:(${values.map(escapeFilterValue).join(' OR ')})`;
			return cleanWhitespace(query.slice(0, match.start) + replacement + query.slice(match.end));
		}

		if (match.value === value) {
			return cleanWhitespace(query.slice(0, match.start) + query.slice(match.end));
		}
	}

	return query;
}

export function clearClauses(query: string): string {
	const matches = parseClauseMatches(query);
	if (matches.length === 0) return cleanWhitespace(query);

	let cleaned = query;
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i];
		cleaned = cleaned.slice(0, match.start) + cleaned.slice(match.end);
	}

	return cleanWhitespace(cleaned);
}

export function shouldAutoClear(
	knownValues: string[],
	field: string,
	currentQuery: string,
	newValue: string,
	exclude: boolean
): boolean {
	// Only auto-clear positive (non-exclude) filters
	if (exclude) return false;

	// Need at least 2 known values — single value auto-clear would be a confusing no-op
	if (knownValues.length < 2) return false;

	// If the new value is already in the query, this isn't completing the set
	if (hasClause(currentQuery, field, newValue, false)) return false;

	// Mixed polarity guard — if any exclude clause exists for this field, skip
	if (parseClauses(currentQuery).some((c) => c.field === field && c.exclude)) return false;

	// Check if every other known value already has a positive clause
	const allKnownCovered = knownValues.every(
		(v) => v === newValue || hasClause(currentQuery, field, v, false)
	);
	if (!allKnownCovered) return false;

	// Guard: if extra positive clauses exist beyond knownValues + newValue, don't auto-clear
	const allowed = new Set([...knownValues, newValue]);
	const hasExtras = parseClauses(currentQuery).some(
		(c) => c.field === field && !c.exclude && !allowed.has(c.value)
	);
	return !hasExtras;
}

function cleanWhitespace(s: string): string {
	return s
		.replace(/\s{2,}/g, ' ')
		.trim()
		.replace(/^(AND|OR)\s+/i, '')
		.replace(/\s+(AND|OR)$/i, '')
		.replace(/\b(AND|OR)\s+(AND|OR)\b/gi, '$1')
		.replace(/^NOT$/i, '')
		.trim();
}
