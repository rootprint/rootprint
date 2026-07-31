import { readString, writeString, removeKey } from '$lib/utils/safe-storage';

/** Scoped per explorer: the traces page only lists paired indexes, so a shared key would clobber logs'. */
const KEYS = {
	logs: 'rootprint:last-index',
	traces: 'rootprint:last-trace-index'
} as const;

export type IndexScope = keyof typeof KEYS;

export function readLastIndex(scope: IndexScope): string | null {
	return readString(KEYS[scope]);
}

export function writeLastIndex(scope: IndexScope, id: string): void {
	writeString(KEYS[scope], id);
}

export function clearLastIndex(scope: IndexScope): void {
	removeKey(KEYS[scope]);
}
