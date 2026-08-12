import { readStringArray, writeJSON } from '$lib/utils/safe-storage';

const KEY_PREFIX = 'rootprint:fields-open:';

function keyFor(indexId: string): string {
	return `${KEY_PREFIX}${indexId}`;
}

export function readOpenFields(indexId: string): Set<string> {
	return new Set(readStringArray(keyFor(indexId)));
}

export function writeOpenFields(indexId: string, fields: Set<string>): void {
	writeJSON(keyFor(indexId), [...fields]);
}
