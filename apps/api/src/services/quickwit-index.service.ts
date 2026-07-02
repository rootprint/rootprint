import type { FieldMapping, FastFieldConfig, IndexMetadata, SourceConfig } from 'quickwit-js';
import { NotFoundError } from 'quickwit-js';
import type { QuickwitClient } from 'quickwit-js';
import type {
	DynamicMapping,
	IndexField,
	QuickwitIndexMetadata,
	QuickwitSource
} from '../types.js';

function normalizeFast(value: FastFieldConfig | undefined): boolean | null {
	if (value === undefined) return null;
	return value !== false;
}

export function normalizeDynamicMapping(
	dm: Record<string, unknown> | undefined | null
): DynamicMapping | null {
	if (!dm) return null;
	return {
		indexed: (dm.indexed as boolean | undefined) ?? true,
		stored: (dm.stored as boolean | undefined) ?? true,
		fast: dm.fast === undefined ? true : dm.fast !== false,
		tokenizer: (dm.tokenizer as string | undefined) ?? 'raw',
		record: (dm.record as string | undefined) ?? 'basic',
		expandDots: (dm.expand_dots as boolean | undefined) ?? true
	};
}

function flattenFieldMappings(mappings: FieldMapping[], prefix = ''): IndexField[] {
	const result: IndexField[] = [];
	for (const f of mappings) {
		const fullName = prefix ? `${prefix}.${f.name}` : f.name;
		if (f.type === 'object' && f.field_mappings) {
			result.push(...flattenFieldMappings(f.field_mappings, fullName));
		} else {
			result.push({
				name: fullName,
				type: f.type,
				fast: normalizeFast(f.fast),
				description: f.description ?? null
			});
		}
	}
	return result;
}

function normalizeRetention(
	r: { period?: string; schedule?: string } | undefined | null
): { period: string; schedule: string | null } | null {
	if (!r || typeof r.period !== 'string') return null;
	return { period: r.period, schedule: r.schedule ?? null };
}

export function normalizeIndexMetadata(meta: IndexMetadata): QuickwitIndexMetadata {
	const cfg = meta.index_config;
	const doc = cfg.doc_mapping;
	const sources: QuickwitSource[] = (meta.sources ?? []).map((s: SourceConfig) => ({
		sourceId: s.source_id,
		sourceType: s.source_type,
		enabled: s.enabled ?? true,
		inputFormat: s.input_format ?? null,
		numPipelines: s.num_pipelines ?? null,
		params: s.params ?? null,
		vrlScript: s.transform?.script ?? null
	}));

	return {
		indexId: cfg.index_id,
		indexUid: meta.index_uid ?? null,
		indexUri: cfg.index_uri ?? null,
		version: cfg.version ?? null,
		createTimestamp: meta.create_timestamp ?? null,
		mode: doc.mode ?? null,
		partitionKey: doc.partition_key ?? null,
		maxNumPartitions: doc.max_num_partitions ?? null,
		dynamicMapping: normalizeDynamicMapping(doc.dynamic_mapping),
		timestampField: doc.timestamp_field ?? null,
		indexFieldPresence: doc.index_field_presence ?? null,
		storeSource: doc.store_source ?? null,
		tagFields: doc.tag_fields ?? null,
		defaultSearchFields: cfg.search_settings?.default_search_fields ?? null,
		commitTimeoutSecs: cfg.indexing_settings?.commit_timeout_secs ?? null,
		retention: normalizeRetention(cfg.retention),
		fields: flattenFieldMappings(doc.field_mappings ?? []),
		sources
	};
}

export async function listIndexes(qw: QuickwitClient): Promise<QuickwitIndexMetadata[]> {
	const all = await qw.listIndexes();
	return all.map(normalizeIndexMetadata);
}

export async function getIndex(
	qw: QuickwitClient,
	indexId: string
): Promise<QuickwitIndexMetadata | null> {
	try {
		return normalizeIndexMetadata(await qw.getIndex(indexId));
	} catch (e) {
		if (e instanceof NotFoundError) return null;
		throw e;
	}
}
