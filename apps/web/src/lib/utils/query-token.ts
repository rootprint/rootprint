export type CaretToken =
	| { kind: 'field'; prefix: string; start: number; end: number }
	| { kind: 'value'; field: string; prefix: string; start: number; end: number };

const BOUNDARY = /[\s(]/;

function inQuote(text: string, pos: number): boolean {
	let quotes = 0;
	for (let i = 0; i < pos; i++) if (text[i] === '"') quotes++;
	return quotes % 2 === 1;
}

export function tokenAtCaret(text: string, caret: number): CaretToken | null {
	let start = caret;
	while (start > 0 && (!BOUNDARY.test(text[start - 1]) || inQuote(text, start - 1))) start--;
	let end = caret;
	while (end < text.length && (!BOUNDARY.test(text[end]) || inQuote(text, end))) end++;

	const token = text.slice(start, end);
	if (token === '') return { kind: 'field', prefix: '', start, end };

	const typed = text.slice(start, caret);
	const colon = token.indexOf(':');
	if (colon === -1 || caret <= start + colon) {
		// caret in the field part; replace through the colon so accepting keeps the value
		return { kind: 'field', prefix: typed, start, end: colon === -1 ? end : start + colon + 1 };
	}

	const field = token.slice(0, colon);
	if (field === '') return null;

	let prefix = typed.slice(colon + 1);
	if (prefix.startsWith('"')) prefix = prefix.slice(1);
	return { kind: 'value', field, prefix, start: start + colon + 1, end };
}
