export function parseWrapMode(value: string | null): 'none' | 'wrap' {
	return value === 'wrap' ? 'wrap' : 'none';
}
