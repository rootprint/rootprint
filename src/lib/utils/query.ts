import type { Clause } from '$lib/types';

const ESCAPE_TRIGGER_RE = /[\s:()[\]{}!+\-~^"\\*?/&|]/;

export function escapeFilterValue(value: string): string {
	if (ESCAPE_TRIGGER_RE.test(value)) {
		return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
	}
	return value;
}

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

const WHITESPACE_RE = /\s/;
const FIELD_START_RE = /[@$_A-Za-z-]/;
const FIELD_BODY_RE = /[@$_/.A-Za-z0-9-]/;
const ASCII_LETTER_RE = /[A-Za-z]/;

function isWhitespace(ch: string): boolean {
	return WHITESPACE_RE.test(ch);
}

function isFieldStartChar(ch: string): boolean {
	return FIELD_START_RE.test(ch);
}

function isFieldBodyChar(ch: string): boolean {
	return FIELD_BODY_RE.test(ch);
}

function unquote(raw: string): string {
	return raw.replaceAll(String.raw`\"`, '"').replaceAll(String.raw`\\`, '\\');
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
		if (quoted?.end !== token.length) return null;
		return quoted.value;
	}

	if (isWhitespace(token)) return null;
	if (token.startsWith('[') || token.startsWith('{')) return null;
	if (token.includes(':')) return null;

	return token;
}

function splitOrGroup(inner: string): string[] | null {
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
	while (i >= 0 && ASCII_LETTER_RE.test(input[i])) i--;
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

	let match: ClauseMatch;

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

function collectMatchValues(matches: ClauseMatch[]): string[] {
	const values: string[] = [];
	for (const match of matches) {
		if (match.kind === 'group') {
			if (match.values) values.push(...match.values);
		} else if (match.value !== undefined) {
			values.push(match.value);
		}
	}
	return values;
}

function formatClause(field: string, values: string[], exclude: boolean): string {
	const prefix = exclude ? '-' : '';
	if (values.length === 1) {
		return `${prefix}${field}:${escapeFilterValue(values[0])}`;
	}
	return `${prefix}${field}:(${values.map(escapeFilterValue).join(' OR ')})`;
}

export function addClause(query: string, field: string, value: string, exclude = false): string {
	const allMatches = parseClauseMatches(query);

	const sameFieldMatches: ClauseMatch[] = [];
	const oppositeFieldMatches: ClauseMatch[] = [];
	for (const match of allMatches) {
		if (match.field !== field) continue;
		if (match.exclude === exclude) sameFieldMatches.push(match);
		else oppositeFieldMatches.push(match);
	}

	if (collectMatchValues(sameFieldMatches).includes(value)) return query;

	if (collectMatchValues(oppositeFieldMatches).includes(value)) {
		query = removeClause(query, field, value, !exclude);
		return addClause(query, field, value, exclude);
	}

	if (sameFieldMatches.length === 0) {
		const clause = formatClause(field, [value], exclude);
		return query ? `${query} ${clause}` : clause;
	}

	const uniqueValues = [...new Set([...collectMatchValues(sameFieldMatches), value])];
	const replacement = formatClause(field, uniqueValues, exclude);

	let result = query;
	for (let i = sameFieldMatches.length - 1; i > 0; i--) {
		result = result.slice(0, sameFieldMatches[i].start) + result.slice(sameFieldMatches[i].end);
	}
	result =
		result.slice(0, sameFieldMatches[0].start) +
		replacement +
		result.slice(sameFieldMatches[0].end);
	return cleanWhitespace(result);
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

			const replacement = formatClause(field, values, exclude);
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

export function consolidateClauses(query: string): string {
	const matches = parseClauseMatches(query);
	if (matches.length < 2) return query;

	const groups = new Map<string, ClauseMatch[]>();
	for (const match of matches) {
		const key = `${match.exclude ? '-' : ''}${match.field}`;
		const list = groups.get(key) ?? [];
		list.push(match);
		groups.set(key, list);
	}

	const ops: { start: number; end: number; replacement?: string }[] = [];
	for (const fieldMatches of groups.values()) {
		if (fieldMatches.length < 2) continue;

		const { field, exclude } = fieldMatches[0];
		const uniqueValues = [...new Set(collectMatchValues(fieldMatches))];
		const replacement = formatClause(field, uniqueValues, exclude);

		ops.push({ start: fieldMatches[0].start, end: fieldMatches[0].end, replacement });
		for (let i = 1; i < fieldMatches.length; i++) {
			ops.push({ start: fieldMatches[i].start, end: fieldMatches[i].end });
		}
	}

	if (ops.length === 0) return query;

	ops.sort((a, b) => b.start - a.start);
	let result = query;
	for (const op of ops) {
		if (op.replacement !== undefined) {
			result = result.slice(0, op.start) + op.replacement + result.slice(op.end);
		} else {
			result = result.slice(0, op.start) + result.slice(op.end);
		}
	}

	return cleanWhitespace(result);
}

export function shouldAutoClear(
	knownValues: string[],
	field: string,
	currentQuery: string,
	newValue: string,
	exclude: boolean
): boolean {
	if (exclude) return false;
	if (knownValues.length < 2) return false;

	const fieldClauses = parseClauses(currentQuery).filter((c) => c.field === field);
	const positiveValues = new Set<string>();
	for (const clause of fieldClauses) {
		if (clause.exclude) return false;
		positiveValues.add(clause.value);
	}

	if (positiveValues.has(newValue)) return false;

	for (const v of knownValues) {
		if (v !== newValue && !positiveValues.has(v)) return false;
	}

	const allowed = new Set([...knownValues, newValue]);
	for (const v of positiveValues) {
		if (!allowed.has(v)) return false;
	}

	return true;
}

const UNQUOTED_AND_RE = /\s+AND\s+/iy;
const COLLAPSE_WS_RE = /\s{2,}/g;
const LEADING_OPERATOR_RE = /^(AND|OR)\s+/i;
const TRAILING_OPERATOR_RE = /\s+(AND|OR)$/i;
const DOUBLE_OPERATOR_RE = /\b(AND|OR)\s+(AND|OR)\b/gi;
const LONE_NOT_RE = /^NOT$/i;

function stripUnquotedAnd(s: string): string {
	let result = '';
	let i = 0;
	while (i < s.length) {
		if (s[i] === '"') {
			const start = i;
			i++;
			while (i < s.length) {
				if (s[i] === '\\' && i + 1 < s.length) {
					i += 2;
					continue;
				}
				if (s[i] === '"') {
					i++;
					break;
				}
				i++;
			}
			result += s.slice(start, i);
			continue;
		}
		if (WHITESPACE_RE.test(s[i])) {
			UNQUOTED_AND_RE.lastIndex = i;
			const andMatch = UNQUOTED_AND_RE.exec(s);
			if (andMatch) {
				result += ' ';
				i += andMatch[0].length;
				continue;
			}
		}
		result += s[i];
		i++;
	}
	return result;
}

function cleanWhitespace(s: string): string {
	return stripUnquotedAnd(
		s
			.replaceAll(COLLAPSE_WS_RE, ' ')
			.trim()
			.replace(LEADING_OPERATOR_RE, '')
			.replace(TRAILING_OPERATOR_RE, '')
			.replaceAll(DOUBLE_OPERATOR_RE, '$1')
			.replace(LONE_NOT_RE, '')
			.trim()
	);
}
