import type {
	CreateIndexRequest,
	DocMapping,
	FieldMapping,
	IndexConfig as QuickwitIndexConfig
} from 'quickwit-js';

import type { DynamicMapping, IndexField } from '../types.js';
import {
	RECORD_OPTIONS,
	TOKENIZERS,
	type CreateIndexInput,
	type FieldMappingInput,
	type UpdateQuickwitConfigInput
} from '../schemas/indexes.js';
import { normalizeDynamicMapping } from './quickwit-index.service.js';

const QUICKWIT_INDEX_CONFIG_VERSION = '0.9';

const DYNAMIC_MAPPING_DEFAULTS: DynamicMapping = {
	indexed: true,
	stored: true,
	fast: true,
	tokenizer: 'raw',
	record: 'basic',
	expandDots: true
};

const FIELD_KEY_RENAME: Record<string, string> = {
	inputFormats: 'input_formats',
	outputFormat: 'output_format',
	fastPrecision: 'fast_precision',
	expandDots: 'expand_dots'
};

function toRetention(r: { period: string; schedule?: string | null }) {
	return r.schedule ? { period: r.period, schedule: r.schedule } : { period: r.period };
}

function sameDynamicMapping(a: DynamicMapping, b: DynamicMapping): boolean {
	return (
		a.indexed === b.indexed &&
		a.stored === b.stored &&
		a.fast === b.fast &&
		a.tokenizer === b.tokenizer &&
		a.record === b.record &&
		a.expandDots === b.expandDots
	);
}

function toComparableDynamicMapping(
	dm: Record<string, unknown> | undefined | null
): DynamicMapping | null {
	const normalized = normalizeDynamicMapping(dm);
	if (!normalized) return null;
	return {
		...normalized,
		tokenizer: (TOKENIZERS as readonly string[]).includes(normalized.tokenizer)
			? normalized.tokenizer
			: 'raw',
		record: (RECORD_OPTIONS as readonly string[]).includes(normalized.record)
			? normalized.record
			: 'basic'
	};
}

function toDynamicMapping(dm: DynamicMapping): Record<string, unknown> {
	return {
		indexed: dm.indexed,
		stored: dm.stored,
		fast: dm.fast,
		tokenizer: dm.tokenizer,
		record: dm.record,
		expand_dots: dm.expandDots
	};
}

function toFieldMapping(input: FieldMappingInput, timestampField: string): FieldMapping {
	const fm: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) fm[FIELD_KEY_RENAME[key] ?? key] = value;
	}
	if (input.name === timestampField) fm.fast = true;

	return fm as unknown as FieldMapping;
}

function sameStringSet(a: string[], b: string[]): boolean {
	return new Set(a).symmetricDifference(new Set(b)).size === 0;
}

export function toCreateIndexRequest(input: CreateIndexInput): CreateIndexRequest {
	const docMapping: DocMapping = {
		field_mappings: input.fieldMappings.map((f) => toFieldMapping(f, input.timestampField)),
		timestamp_field: input.timestampField
	};
	if (input.mode) docMapping.mode = input.mode;
	if (input.dynamicMapping && (input.mode ?? 'dynamic') === 'dynamic') {
		docMapping.dynamic_mapping = toDynamicMapping(input.dynamicMapping);
	}
	if (input.partitionKey) {
		docMapping.partition_key = input.partitionKey;
		if (input.maxNumPartitions !== undefined) {
			docMapping.max_num_partitions = input.maxNumPartitions;
		}
	}
	if (input.storeSource !== undefined) docMapping.store_source = input.storeSource;
	if (input.indexFieldPresence !== undefined) {
		docMapping.index_field_presence = input.indexFieldPresence;
	}
	if (input.tagFields) docMapping.tag_fields = input.tagFields;

	const request: CreateIndexRequest = {
		version: QUICKWIT_INDEX_CONFIG_VERSION,
		index_id: input.indexId,
		doc_mapping: docMapping
	};
	if (input.indexUri) request.index_uri = input.indexUri;
	if (input.commitTimeoutSecs !== undefined) {
		request.indexing_settings = { commit_timeout_secs: input.commitTimeoutSecs };
	}
	if (input.defaultSearchFields) {
		request.search_settings = { default_search_fields: input.defaultSearchFields };
	}
	if (input.retention) request.retention = toRetention(input.retention);

	return request;
}

export function findFieldCollisions(
	cfg: QuickwitIndexConfig,
	existingFields: IndexField[],
	newFieldMappings: FieldMappingInput[]
): number[] {
	const existingNames = new Set<string>([
		...(cfg.doc_mapping.field_mappings ?? []).map((f) => f.name),
		...existingFields.map((f) => f.name)
	]);
	return newFieldMappings.flatMap((f, i) => (existingNames.has(f.name) ? [i] : []));
}

export function toUpdateIndexRequest(
	cfg: QuickwitIndexConfig,
	input: UpdateQuickwitConfigInput
): CreateIndexRequest {
	const doc = cfg.doc_mapping;

	const desiredDynamicMapping =
		input.mode === 'dynamic' ? (input.dynamicMapping ?? DYNAMIC_MAPPING_DEFAULTS) : null;
	const dynamicMappingChanged = !sameDynamicMapping(
		toComparableDynamicMapping(doc.dynamic_mapping) ?? DYNAMIC_MAPPING_DEFAULTS,
		desiredDynamicMapping ?? DYNAMIC_MAPPING_DEFAULTS
	);

	// Quickwit serializes an unset partition key as '' and defaults max_num_partitions
	// to 200, so compare against those to avoid rewriting a config that didn't change.
	const partitioningChanged =
		(doc.partition_key ?? '') !== (input.partitionKey ?? '') ||
		(doc.max_num_partitions ?? 200) !== (input.maxNumPartitions ?? 200);

	const docChanged =
		input.newFieldMappings.length > 0 ||
		dynamicMappingChanged ||
		partitioningChanged ||
		(doc.mode ?? 'dynamic') !== input.mode ||
		(doc.store_source ?? false) !== input.storeSource ||
		(doc.index_field_presence ?? false) !== input.indexFieldPresence ||
		!sameStringSet(doc.tag_fields ?? [], input.tagFields);

	let docMapping: DocMapping;
	if (docChanged) {
		const ts = doc.timestamp_field ?? '';
		docMapping = {
			...doc,
			mode: input.mode,
			store_source: input.storeSource,
			index_field_presence: input.indexFieldPresence,
			tag_fields: input.tagFields,
			field_mappings: [
				...(doc.field_mappings ?? []),
				...input.newFieldMappings.map((f) => toFieldMapping(f, ts))
			]
		};
		if (dynamicMappingChanged || input.mode !== 'dynamic') {
			if (
				desiredDynamicMapping &&
				!sameDynamicMapping(desiredDynamicMapping, DYNAMIC_MAPPING_DEFAULTS)
			) {
				docMapping.dynamic_mapping = toDynamicMapping(desiredDynamicMapping);
			} else {
				delete docMapping.dynamic_mapping;
			}
		}
		if (input.partitionKey) {
			docMapping.partition_key = input.partitionKey;
			if (input.maxNumPartitions !== null) {
				docMapping.max_num_partitions = input.maxNumPartitions;
			} else {
				delete docMapping.max_num_partitions;
			}
		} else {
			delete docMapping.partition_key;
			delete docMapping.max_num_partitions;
		}
	} else {
		docMapping = { ...doc };
	}
	delete docMapping.doc_mapping_uid;

	const searchSettings = { ...cfg.search_settings };
	if (input.defaultSearchFields.length > 0) {
		searchSettings.default_search_fields = input.defaultSearchFields;
	} else {
		delete searchSettings.default_search_fields;
	}

	const indexingSettings = { ...cfg.indexing_settings };
	if (input.commitTimeoutSecs === null) {
		delete indexingSettings.commit_timeout_secs;
	} else {
		indexingSettings.commit_timeout_secs = input.commitTimeoutSecs;
	}

	const request = { ...cfg } as CreateIndexRequest;
	if (!request.version) request.version = QUICKWIT_INDEX_CONFIG_VERSION;
	request.doc_mapping = docMapping;

	if (Object.keys(searchSettings).length > 0) request.search_settings = searchSettings;
	else delete request.search_settings;

	if (Object.keys(indexingSettings).length > 0) request.indexing_settings = indexingSettings;
	else delete request.indexing_settings;

	if (input.retention) request.retention = toRetention(input.retention);
	else delete request.retention;

	return request;
}
