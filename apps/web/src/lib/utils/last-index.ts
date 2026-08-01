import { readString, writeString, removeKey } from '$lib/utils/safe-storage';

const LAST_INDEX_KEY = 'rootprint:last-index';

export function readLastIndex(): string | null {
	return readString(LAST_INDEX_KEY);
}

export function writeLastIndex(id: string): void {
	writeString(LAST_INDEX_KEY, id);
}

export function clearLastIndex(): void {
	removeKey(LAST_INDEX_KEY);
}
