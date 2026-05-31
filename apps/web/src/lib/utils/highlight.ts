/**
 * Splits `text` into alternating non-match / match segments around every
 * case-insensitive occurrence of `term`. Returns a single non-match segment
 * when `term` is empty or not found. Consumers render match segments with
 * a `<mark>` (or styled span) for a Ctrl+F-style highlight effect.
 */
export interface HighlightSegment {
	text: string;
	match: boolean;
}

export function highlightSegments(text: string, term: string): HighlightSegment[] {
	if (!term) return [{ text, match: false }];
	const lowerText = text.toLowerCase();
	const lowerTerm = term.toLowerCase();
	const segments: HighlightSegment[] = [];
	let cursor = 0;
	while (cursor < text.length) {
		const idx = lowerText.indexOf(lowerTerm, cursor);
		if (idx === -1) {
			segments.push({ text: text.slice(cursor), match: false });
			break;
		}
		if (idx > cursor) {
			segments.push({ text: text.slice(cursor, idx), match: false });
		}
		segments.push({ text: text.slice(idx, idx + term.length), match: true });
		cursor = idx + term.length;
	}
	return segments;
}
