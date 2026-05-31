import type { FieldMapping, FastFieldConfig, IndexMetadata, SourceConfig } from 'quickwit-js';
import { NotFoundError } from 'quickwit-js';
import type { QuickwitClient } from 'quickwit-js';
import type { IndexField } from '../types.js';

type QuickwitSource = {
	sourceId: string;
	sourceType: string;
	enabled: boolean;
	inputFormat: string | null;
	numPipelines: number | null;
	params: unknown | null;
};

type QuickwitIndexMetadata = {
	indexId: string;
	indexUid: string | null;
	indexUri: string | null;
	version: string | null;
	createTimestamp: number | null;
	mode: string | null;
	timestampField: string | null;
	indexFieldPresence: boolean | null;
	storeSource: boolean | null;
	storeDocumentSize: boolean | null;
	tagFields: string[] | null;
	defaultSearchFields: string[] | null;
	retention: unknown | null;
	fields: IndexField[];
	sources: QuickwitSource[];
};

function normalizeFast(value: FastFieldConfig | undefined): boolean | null {
	if (value === undefined) return null;
	return value !== false;
}

function flattenFieldMappings(mappings: FieldMapping[], prefix = ''): IndexField[] {
	const result: IndexField[] = [];
	for (const f of mappings) {
		const fullName = prefix ? `${prefix}.${f.name}` : f.name;
		if (f.type === 'object' && f.field_mappings) {
			result.push(...flattenFieldMappings(f.field_mappings, fullName));
		} else {
			result.push({ name: fullName, type: f.type, fast: normalizeFast(f.fast) });
		}
	}
	return result;
}

function normalize(meta: IndexMetadata): QuickwitIndexMetadata {
	const cfg = meta.index_config;
	const doc = cfg.doc_mapping;
	const sources: QuickwitSource[] = (meta.sources ?? []).map((s: SourceConfig) => ({
		sourceId: s.source_id,
		sourceType: s.source_type,
		enabled: s.enabled ?? true,
		inputFormat: s.input_format ?? null,
		numPipelines: s.num_pipelines ?? null,
		params: s.params ?? null
	}));

	return {
		indexId: cfg.index_id,
		indexUid: meta.index_uid ?? null,
		indexUri: cfg.index_uri ?? null,
		version: cfg.version ?? null,
		createTimestamp: meta.create_timestamp ?? null,
		mode: doc.mode ?? null,
		timestampField: doc.timestamp_field ?? null,
		indexFieldPresence: doc.index_field_presence ?? null,
		storeSource: doc.store_source ?? null,
		storeDocumentSize: doc.store_document_size ?? null,
		tagFields: doc.tag_fields ?? null,
		defaultSearchFields: cfg.search_settings?.default_search_fields ?? null,
		retention: cfg.retention ?? null,
		fields: flattenFieldMappings(doc.field_mappings ?? []),
		sources
	};
}

export async function listIndexes(qw: QuickwitClient): Promise<QuickwitIndexMetadata[]> {
	const all = await qw.listIndexes();
	return all.map(normalize);
}

export async function getIndex(
	qw: QuickwitClient,
	indexId: string
): Promise<QuickwitIndexMetadata | null> {
	try {
		return normalize(await qw.getIndex(indexId));
	} catch (e) {
		if (e instanceof NotFoundError) return null;
		throw e;
	}
}
