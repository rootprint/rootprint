import { quickwitClient } from '$lib/server/quickwit';
import { flattenObject } from '$lib/utils/log-helpers';
import { escapeFilterValue } from '$lib/utils/query';
import { normalizeToMs } from '$lib/utils/time';

import { getFieldConfig } from './index.service';

// 50 neighbors per direction + the anchor itself, before dedup.
const INITIAL_HITS_PER_DIRECTION = 51;

function isExcludedField(key: string, excluded: Set<string>, prefixes: string[]): boolean {
	if (excluded.has(key)) return true;
	for (const prefix of prefixes) {
		if (key.startsWith(prefix + '.')) return true;
	}
	return false;
}

function buildContextQuery(
	flat: [string, unknown][],
	contextFields: string[] | null,
	excludedFields: string[],
	messageField: string,
	timestampField: string,
	levelField: string
): { query: string; activeLabels: { field: string; value: unknown }[] } {
	const excluded = new Set([...excludedFields, messageField, timestampField, levelField]);
	const excludedPrefixes = [messageField, timestampField, levelField];

	const allowed = contextFields?.length ? new Set(contextFields) : null;
	const candidates = flat.filter(
		([key]) =>
			!isExcludedField(key, excluded, excludedPrefixes) && (allowed === null || allowed.has(key))
	);

	const scalars = candidates.filter(
		([, value]) => value !== null && value !== undefined && typeof value !== 'object'
	);

	const activeLabels = scalars.map(([field, value]) => ({ field, value }));

	if (scalars.length === 0) {
		return { query: '*', activeLabels: [] };
	}

	const parts = scalars.map(([key, value]) => {
		const strValue = String(value);
		return `${key}:${escapeFilterValue(strValue)}`;
	});

	return { query: parts.join(' AND '), activeLabels };
}

// Both copies of a duplicated hit originate from the same Quickwit `_source`
// payload in the same response cycle, so flattened+sorted entries match
// byte-for-byte without needing a content hash or timestamp normalization.
function logKey(flat: [string, unknown][]): string {
	const sorted = [...flat].sort((a, b) => a[0].localeCompare(b[0]));
	return JSON.stringify(sorted);
}

function extractTimestampMs(flat: [string, unknown][], timestampField: string): number {
	const entry = flat.find(([key]) => key === timestampField);
	if (!entry) throw new Error(`Timestamp field "${timestampField}" not found in log`);
	const raw = entry[1];
	if (typeof raw === 'number') return normalizeToMs(raw);
	const ms = new Date(String(raw)).getTime();
	if (Number.isNaN(ms)) throw new Error(`Invalid timestamp value: ${JSON.stringify(raw)}`);
	return ms;
}

export async function getLogContext(
	indexId: string,
	log: Record<string, unknown>,
	excludedFields: string[]
): Promise<{
	hits: Record<string, unknown>[];
	selectedIndex: number;
	anchorTs: number;
	activeLabels: { field: string; value: unknown }[];
	noMoreAfter: boolean;
	noMoreBefore: boolean;
}> {
	const config = await getFieldConfig(indexId);
	const index = quickwitClient.index(indexId);

	const flatLog = flattenObject(log);

	const { query: contextQuery, activeLabels } = buildContextQuery(
		flatLog,
		config.contextFields,
		excludedFields,
		config.messageField,
		config.timestampField,
		config.levelField
	);

	const anchorTs = Math.floor(extractTimestampMs(flatLog, config.timestampField) / 1000);

	const afterQuery = index
		.query(contextQuery)
		.limit(INITIAL_HITS_PER_DIRECTION)
		.offset(0)
		.sortBy(config.timestampField, 'asc');
	afterQuery.timeRange(anchorTs);

	const beforeQuery = index
		.query(contextQuery)
		.limit(INITIAL_HITS_PER_DIRECTION)
		.offset(0)
		.sortBy(config.timestampField, 'desc');
	beforeQuery.timeRange(undefined, anchorTs);

	const [afterResult, beforeResult] = await Promise.all([
		index.search(afterQuery),
		index.search(beforeQuery)
	]);

	const seen = new Set<string>([logKey(flatLog)]);
	const combined: Record<string, unknown>[] = [log];
	for (const h of [...afterResult.hits, ...beforeResult.hits]) {
		const key = logKey(flattenObject(h));
		if (!seen.has(key)) {
			seen.add(key);
			combined.push(h);
		}
	}

	const tsCache = new WeakMap<object, number>();
	const ts = (h: Record<string, unknown>) => {
		let v = tsCache.get(h);
		if (v === undefined) {
			v = extractTimestampMs(flattenObject(h), config.timestampField);
			tsCache.set(h, v);
		}
		return v;
	};
	combined.sort((a, b) => ts(b) - ts(a));

	const selectedIndex = combined.indexOf(log);
	if (selectedIndex < 0) throw new Error('Selected log lost during context assembly');

	return {
		hits: combined,
		selectedIndex,
		anchorTs,
		activeLabels,
		noMoreAfter: afterResult.hits.length < INITIAL_HITS_PER_DIRECTION,
		noMoreBefore: beforeResult.hits.length < INITIAL_HITS_PER_DIRECTION
	};
}

export async function getMoreContext(
	indexId: string,
	log: Record<string, unknown>,
	excludedFields: string[],
	direction: 'before' | 'after',
	anchorTs: number,
	offset: number,
	limit: number
): Promise<Record<string, unknown>[]> {
	const config = await getFieldConfig(indexId);
	const index = quickwitClient.index(indexId);

	const flatLog = flattenObject(log);

	const { query: contextQuery } = buildContextQuery(
		flatLog,
		config.contextFields,
		excludedFields,
		config.messageField,
		config.timestampField,
		config.levelField
	);

	const sort = direction === 'before' ? 'desc' : 'asc';
	const q = index
		.query(contextQuery)
		.limit(limit)
		.offset(offset)
		.sortBy(config.timestampField, sort);

	if (direction === 'before') {
		q.timeRange(undefined, anchorTs);
	} else {
		q.timeRange(anchorTs);
	}

	const result = await index.search(q);

	if (direction === 'after') {
		// ASC results → reverse to DESC for display
		return [...result.hits].reverse();
	}
	return result.hits;
}
