export const KEY_OPEN = '\x00KEY\x00';
export const KEY_CLOSE = '\x00/KEY\x00';

/**
 * Wraps an API key value with sentinel markers when it represents a real
 * substitution, so CodeBlock can highlight it post-syntax-highlighting.
 * Returns the bare value (no markers) when no real API key is present.
 */
export function apiKeySubstring(value: string, hasRealApiKey: boolean): string {
	return hasRealApiKey ? `${KEY_OPEN}${value}${KEY_CLOSE}` : value;
}

/**
 * Strips API key sentinels from a string. Used to derive the clipboard-safe
 * raw code before sentinels are converted to highlight spans.
 */
export function stripApiKeySentinels(code: string): string {
	return code.replaceAll(KEY_OPEN, '').replaceAll(KEY_CLOSE, '');
}
