export type QueryContext =
	| { type: 'field'; fragment: string; start: number; end: number }
	| { type: 'value'; field: string; fragment: string; start: number; end: number }
	| { type: 'none' };

const OPERATORS = ['AND', 'OR', 'NOT'];

export function getQueryContext(query: string, cursorPos: number): QueryContext {
	// Check if cursor is inside a quoted string
	let inQuote = false;
	for (let i = 0; i < cursorPos; i++) {
		if (query[i] === '"' && (i === 0 || query[i - 1] !== '\\')) {
			inQuote = !inQuote;
		}
	}
	if (inQuote) return { type: 'none' };

	// Extract the text from start to cursor
	const textToCursor = query.slice(0, cursorPos);

	// Find the start of the current token (walk backwards from cursor)
	let tokenStart = cursorPos;
	while (tokenStart > 0 && !/[\s()]/.test(textToCursor[tokenStart - 1])) {
		tokenStart--;
	}
	const currentToken = textToCursor.slice(tokenStart);

	// Check for range query syntax: field:[... or field:{...
	if (/\[/.test(currentToken) || /\{/.test(currentToken)) {
		return { type: 'none' };
	}

	// Check if current token contains a colon — value context
	const colonIdx = currentToken.indexOf(':');
	if (colonIdx !== -1) {
		const field = currentToken.slice(0, colonIdx);
		const fragment = currentToken.slice(colonIdx + 1);

		// Skip advanced syntax (range, regex, grouped)
		if (
			fragment.startsWith('[') ||
			fragment.startsWith('{') ||
			fragment.startsWith('/') ||
			fragment.startsWith('(')
		) {
			return { type: 'none' };
		}

		return {
			type: 'value',
			field,
			fragment,
			start: tokenStart + colonIdx + 1,
			end: cursorPos
		};
	}

	// No colon — field context
	return {
		type: 'field',
		fragment: currentToken,
		start: tokenStart,
		end: cursorPos
	};
}

export function validateQuery(query: string): string | null {
	const trimmed = query.trim();
	if (!trimmed || trimmed === '*') return null;

	// Check unmatched quotes
	let quoteCount = 0;
	for (let i = 0; i < trimmed.length; i++) {
		if (trimmed[i] === '"' && (i === 0 || trimmed[i - 1] !== '\\')) {
			quoteCount++;
		}
	}
	if (quoteCount % 2 !== 0) return 'Unmatched quote';

	// Check unmatched parentheses
	let depth = 0;
	let inQuote = false;
	for (let i = 0; i < trimmed.length; i++) {
		if (trimmed[i] === '"' && (i === 0 || trimmed[i - 1] !== '\\')) {
			inQuote = !inQuote;
			continue;
		}
		if (inQuote) continue;
		if (trimmed[i] === '(') depth++;
		if (trimmed[i] === ')') depth--;
		if (depth < 0) return 'Unmatched closing parenthesis';
	}
	if (depth > 0) return 'Unmatched opening parenthesis';

	// Tokenize (respecting quotes)
	const tokens: string[] = [];
	let current = '';
	inQuote = false;
	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (ch === '"' && (i === 0 || trimmed[i - 1] !== '\\')) {
			inQuote = !inQuote;
			current += ch;
			continue;
		}
		if (inQuote) {
			current += ch;
			continue;
		}
		if (/[\s]/.test(ch)) {
			if (current) tokens.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	if (current) tokens.push(current);

	// Strip parentheses from tokens for operator checking
	const cleaned = tokens.map((t) => t.replace(/[()]/g, '').trim()).filter(Boolean);

	if (cleaned.length === 0) return null;

	// Check operator at start (AND/OR not allowed, NOT is allowed)
	if (cleaned[0] === 'AND' || cleaned[0] === 'OR') {
		return `Unexpected '${cleaned[0]}' at start of query`;
	}

	// Check dangling operator at end
	const last = cleaned[cleaned.length - 1];
	if (last === 'AND' || last === 'OR' || last === 'NOT') {
		return `Expected expression after '${last}'`;
	}

	// Check empty field values: "field:" followed by an operator or end
	for (let i = 0; i < cleaned.length; i++) {
		const token = cleaned[i];
		if (token.endsWith(':')) {
			const fieldName = token.slice(0, -1);
			const next = cleaned[i + 1];
			if (!next || next === 'AND' || next === 'OR' || next === 'NOT') {
				return `Empty value after '${fieldName}:'`;
			}
		}
	}

	return null;
}
