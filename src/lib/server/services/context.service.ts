import { getQuickwitClient } from '$lib/server/quickwit';
import { getFieldConfig } from './index.service';
import { flattenObject } from '$lib/utils/log-helpers';
import { escapeFilterValue } from '$lib/utils/query';
import { normalizeToMs } from '$lib/utils/time';
import { fingerprint, extractTimestampSeconds } from '$lib/server/utils/fingerprint';

function isExcludedField(key: string, excluded: Set<string>, prefixes: string[]): boolean {
	if (excluded.has(key)) return true;
	for (const prefix of prefixes) {
		if (key.startsWith(prefix + '.')) return true;
	}
	return false;
}

function buildContextQuery(
	log: Record<string, unknown>,
	contextFields: string[] | null,
	excludedFields: string[],
	messageField: string,
	timestampField: string,
	levelField: string
): { query: string; activeLabels: { field: string; value: unknown }[] } {
	const flat = flattenObject(log);
	const excluded = new Set([...excludedFields, messageField, timestampField, levelField]);
	const excludedPrefixes = [messageField, timestampField, levelField];

	let candidates: [string, unknown][];
	if (contextFields && contextFields.length > 0) {
		const allowed = new Set(contextFields);
		candidates = flat.filter(
			([key]) => allowed.has(key) && !isExcludedField(key, excluded, excludedPrefixes)
		);
	} else {
		candidates = flat.filter(([key]) => !isExcludedField(key, excluded, excludedPrefixes));
	}

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

function extractTimestampMs(log: Record<string, unknown>, timestampField: string): number {
	const flat = flattenObject(log);
	const entry = flat.find(([key]) => key === timestampField);
	if (!entry) throw new Error(`Timestamp field "${timestampField}" not found in log`);
	const raw = entry[1];
	if (typeof raw === 'number') return normalizeToMs(raw);
	const ms = new Date(String(raw)).getTime();
	if (isNaN(ms)) throw new Error(`Invalid timestamp value: ${raw}`);
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
	const config = getFieldConfig(indexId);
	const client = getQuickwitClient();
	const index = client.index(indexId);

	const { query: contextQuery, activeLabels } = buildContextQuery(
		log,
		config.contextFields,
		excludedFields,
		config.messageField,
		config.timestampField,
		config.levelField
	);

	const anchorTs = extractTimestampSeconds(log, config.timestampField);
	const selectedFp = fingerprint(log, config.timestampField);

	// Fetch newer and older logs in parallel
	const afterQuery = index
		.query(contextQuery)
		.limit(51)
		.offset(0)
		.sortBy(config.timestampField, 'asc');
	afterQuery.timeRange(anchorTs, undefined);

	const beforeQuery = index
		.query(contextQuery)
		.limit(51)
		.offset(0)
		.sortBy(config.timestampField, 'desc');
	beforeQuery.timeRange(undefined, anchorTs);

	const [afterResult, beforeResult] = await Promise.all([
		index.search(afterQuery),
		index.search(beforeQuery)
	]);

	// Combine all hits, dedup by fingerprint
	const seen = new Set<string>();
	seen.add(selectedFp);

	const combined: Record<string, unknown>[] = [];
	for (const h of afterResult.hits) {
		const fp = fingerprint(h, config.timestampField);
		if (!seen.has(fp)) {
			seen.add(fp);
			combined.push(h);
		}
	}
	for (const h of beforeResult.hits) {
		const fp = fingerprint(h, config.timestampField);
		if (!seen.has(fp)) {
			seen.add(fp);
			combined.push(h);
		}
	}

	// Add selected log and sort everything by timestamp DESC
	combined.push(log);
	combined.sort((a, b) => {
		return (
			extractTimestampMs(b, config.timestampField) - extractTimestampMs(a, config.timestampField)
		);
	});

	// Find selected log position
	let selectedIndex = 0;
	for (let i = 0; i < combined.length; i++) {
		if (fingerprint(combined[i], config.timestampField) === selectedFp) {
			selectedIndex = i;
			break;
		}
	}

	return {
		hits: combined,
		selectedIndex,
		anchorTs,
		activeLabels,
		noMoreAfter: afterResult.hits.length < 51,
		noMoreBefore: beforeResult.hits.length < 51
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
	const config = getFieldConfig(indexId);
	const client = getQuickwitClient();
	const index = client.index(indexId);

	const { query: contextQuery } = buildContextQuery(
		log,
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
		q.timeRange(anchorTs, undefined);
	}

	const result = await index.search(q);

	if (direction === 'after') {
		// ASC results → reverse to DESC for display
		const reversed: Record<string, unknown>[] = [];
		for (let i = result.hits.length - 1; i >= 0; i--) {
			reversed.push(result.hits[i]);
		}
		return reversed;
	}
	return result.hits;
}
