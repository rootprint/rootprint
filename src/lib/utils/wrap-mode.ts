import type { WrapMode } from '$lib/types';

export function parseWrapMode(value: string | null): WrapMode {
	return value === 'wrap' ? 'wrap' : 'none';
}
