import { createHash } from 'node:crypto';

import { flattenObject } from '$lib/utils/log-helpers';
import { normalizeToMs } from '$lib/utils/time';

function normalizeTimestamp(entries: [string, unknown][], timestampField: string): void {
	const idx = entries.findIndex(([key]) => key === timestampField);
	if (idx === -1) return;
	const raw = entries[idx][1];
	if (raw === null || raw === undefined) return;
	const ms = typeof raw === 'number' ? normalizeToMs(raw) : new Date(String(raw)).getTime();
	if (!Number.isNaN(ms)) {
		entries[idx] = [entries[idx][0], Math.floor(ms)];
	}
}

export function fingerprint(hit: Record<string, unknown>, timestampField?: string): string {
	const entries = flattenObject(hit);
	if (timestampField) normalizeTimestamp(entries, timestampField);
	entries.sort((a, b) => a[0].localeCompare(b[0]));
	return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

export function extractTimestampSeconds(
	log: Record<string, unknown>,
	timestampField: string
): number {
	const flat = flattenObject(log);
	const entry = flat.find(([key]) => key === timestampField);
	if (!entry) throw new Error(`Timestamp field "${timestampField}" not found in log`);
	const raw = entry[1];
	if (typeof raw === 'number') {
		return Math.floor(normalizeToMs(raw) / 1000);
	}
	const date = new Date(String(raw));
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp value: ${JSON.stringify(raw)}`);
	return Math.floor(date.getTime() / 1000);
}
