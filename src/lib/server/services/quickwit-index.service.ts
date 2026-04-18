import type { FastFieldConfig, FieldMapping, IndexMetadata } from 'quickwit-js';
import { NotFoundError } from 'quickwit-js';

import { getQuickwitClient } from '$lib/server/quickwit';
import type { QuickwitField, QuickwitIndexMetadata, QuickwitSource } from '$lib/types';

// Tri-state: null = unset, true = on (boolean true OR { normalizer }), false = explicitly off.
// The null case lets downstream rules treat unset differently from explicit false.
function normalizeFast(value: FastFieldConfig | undefined): boolean | null {
	if (value === undefined) return null;
	return value !== false;
}

function flattenFieldMappings(mappings: FieldMapping[], prefix = ''): QuickwitField[] {
	const result: QuickwitField[] = [];
	for (const f of mappings) {
		const fullName = prefix ? `${prefix}.${f.name}` : f.name;
		if (f.type === 'object' && f.field_mappings) {
			result.push(...flattenFieldMappings(f.field_mappings, fullName));
		} else {
			result.push({
				name: fullName,
				type: f.type,
				fast: normalizeFast(f.fast),
				indexed: f.indexed ?? null,
				stored: f.stored ?? null,
				record: f.record ?? null,
				tokenizer: f.tokenizer ?? null,
				description: f.description ?? null
			});
		}
	}
	return result;
}

function normalize(meta: IndexMetadata): QuickwitIndexMetadata {
	const cfg = meta.index_config;
	const doc = cfg.doc_mapping;
	const sources: QuickwitSource[] = (meta.sources ?? []).map((s) => ({
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

export async function listIndexMetadata(): Promise<QuickwitIndexMetadata[]> {
	const all = await getQuickwitClient().listIndexes();
	return all.map(normalize);
}

export async function getIndexMetadata(indexId: string): Promise<QuickwitIndexMetadata | null> {
	try {
		return normalize(await getQuickwitClient().getIndex(indexId));
	} catch (e) {
		if (e instanceof NotFoundError) return null;
		throw e;
	}
}
