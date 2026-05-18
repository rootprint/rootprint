export const TOK_OPEN = '\x00TOK\x00';
export const TOK_CLOSE = '\x00/TOK\x00';

/**
 * Wraps a token value with sentinel markers when it represents a real
 * substitution, so CodeBlock can highlight it post-syntax-highlighting.
 * Returns the bare value (no markers) when no real token is present.
 */
export function tokenSubstring(value: string, hasRealToken: boolean): string {
	return hasRealToken ? `${TOK_OPEN}${value}${TOK_CLOSE}` : value;
}

/**
 * Strips token sentinels from a string. Used to derive the clipboard-safe
 * raw code before sentinels are converted to highlight spans.
 */
export function stripTokenSentinels(code: string): string {
	return code.replaceAll(TOK_OPEN, '').replaceAll(TOK_CLOSE, '');
}
