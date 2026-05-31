import { readJSON, writeJSON } from '$lib/utils/safe-storage';

const KEY_PREFIX = 'rootprint:fields-open:';

function keyFor(indexId: string): string {
	return `${KEY_PREFIX}${indexId}`;
}

export function readOpenFields(indexId: string): Set<string> {
	const parsed = readJSON<unknown>(keyFor(indexId), []);
	if (!Array.isArray(parsed)) return new Set();
	return new Set(parsed.filter((v): v is string => typeof v === 'string'));
}

export function writeOpenFields(indexId: string, fields: Set<string>): void {
	writeJSON(keyFor(indexId), [...fields]);
}
