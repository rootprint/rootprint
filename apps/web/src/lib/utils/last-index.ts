import { readString, writeString, removeKey } from '$lib/utils/safe-storage';

const KEY = 'rootprint:last-index';

export function readLastIndex(): string | null {
	return readString(KEY);
}

export function writeLastIndex(id: string): void {
	writeString(KEY, id);
}

export function clearLastIndex(): void {
	removeKey(KEY);
}
