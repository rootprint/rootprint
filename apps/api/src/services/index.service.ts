import { eq, inArray } from 'drizzle-orm';
import type {
	DynamicMapping,
	IndexConfig,
	IndexDetail,
	IndexField,
	IndexMeta,
	IndexSettings,
	IndexSummary,
	IndexView,
	IndexViewConfig,
	IndexVisibility,
	QuickwitIndexMetadata
} from '../types.js';
import {
	NotFoundError,
	QuickwitError,
	type CreateIndexRequest,
	type DocMapping,
	type FieldMapping,
	type IndexMetadata,
	type QuickwitClient
} from 'quickwit-js';

import type { Db } from '../db/index.js';
import {
	apiKey,
	indexSettings,
	indexStatsSnapshot,
	searchAudit,
	share,
	userPreference,
	view as viewTable
} from '../db/schema.js';
import { conflict, indexAccessError, internal, notFound } from '../utils/http-error.js';
import { translateQuickwitError, withNotFound } from '../utils/quickwit-error.js';
import { invalidateApiKeyCache } from './api-key.service.js';
import {
	RECORD_OPTIONS,
	TOKENIZERS,
	type CreateIndexInput,
	type FieldMappingInput,
	type SaveIndexConfigInput,
	type UpdateQuickwitConfigInput
} from '../schemas/indexes.js';
import {
	getIndex as qwGetIndex,
	listIndexes as qwListIndexes,
	normalizeIndexMetadata,
	normalizeDynamicMapping
} from './quickwit-index.service.js';

const DEFAULT_SETTINGS: IndexSettings = {
	displayName: null,
	visibility: 'all',
	levelField: 'severity_text',
	messageField: 'body.message',
	tracebackField: 'attributes.exception.stacktrace',
	contextFields: null
};

const DEFAULT_CONTEXT_FIELDS = ['service_name'];

function toIndexSettings(row: typeof indexSettings.$inferSelect): IndexSettings {
	return {
		displayName: row.displayName,
		visibility: row.visibility,
		levelField: row.levelField,
		messageField: row.messageField,
		tracebackField: row.tracebackField,
		contextFields: row.contextFields
	};
}

export async function getIndexSettings(db: Db, indexId: string): Promise<IndexSettings> {
	const [row] = await db
		.select()
		.from(indexSettings)
		.where(eq(indexSettings.indexId, indexId))
		.limit(1);

	if (!row) return DEFAULT_SETTINGS;

	return toIndexSettings(row);
}

export function canAccessIndex(visibility: IndexVisibility, isAdmin: boolean): boolean {
	if (visibility === 'hidden') return false;
	if (visibility === 'admin') return isAdmin;
	return true;
}

export async function saveIndexConfig(
	db: Db,
	indexId: string,
	fields: SaveIndexConfigInput
): Promise<void> {
	const updatedAt = new Date();
	await db
		.insert(indexSettings)
		.values({ indexId, ...fields, updatedAt })
		.onConflictDoUpdate({
			target: indexSettings.indexId,
			set: { ...fields, updatedAt }
		});
}

function toIndexSummary(m: QuickwitIndexMetadata, settings: IndexSettings): IndexSummary {
	return {
		indexId: m.indexId,
		displayName: settings.displayName,
		visibility: settings.visibility,
		fieldCount: m.fields.length,
		sourceCount: m.sources.length,
		mode: m.mode,
		createTimestamp: m.createTimestamp
	};
}

export async function listAllIndexes(db: Db, qw: QuickwitClient): Promise<IndexSummary[]> {
	const indexes = await qwListIndexes(qw);

	const ids = indexes.map((m) => m.indexId);
	const rows = ids.length
		? await db.select().from(indexSettings).where(inArray(indexSettings.indexId, ids))
		: [];
	const settingsMap = new Map<string, IndexSettings>(
		rows.map((r) => [r.indexId, toIndexSettings(r)])
	);

	return indexes.map((m) => toIndexSummary(m, settingsMap.get(m.indexId) ?? DEFAULT_SETTINGS));
}

export async function listIndexes(
	db: Db,
	qw: QuickwitClient,
	role: string | null | undefined,
	view: IndexView = 'search'
): Promise<IndexSummary[]> {
	const all = await listAllIndexes(db, qw);
	const isAdmin = role === 'admin';
	const adminView = view === 'admin' && isAdmin;
	return all.filter((m) => adminView || canAccessIndex(m.visibility, isAdmin));
}

export async function getIndexMeta(
	db: Db,
	qw: QuickwitClient,
	indexId: string,
	role: string | null | undefined,
	view: IndexView
): Promise<IndexMeta> {
	const [settings, index] = await Promise.all([
		getIndexSettings(db, indexId),
		qwGetIndex(qw, indexId)
	]);
	const isAdmin = role === 'admin';
	const adminView = view === 'admin' && isAdmin;
	if (!adminView && !canAccessIndex(settings.visibility, isAdmin)) {
		throw indexAccessError(isAdmin, 'denied');
	}
	if (!index) throw indexAccessError(isAdmin, 'missing');
	return { settings, index };
}

function resolveLogFields({ settings, index }: IndexMeta) {
	if (!index.timestampField) throw internal(`Index "${index.indexId}" has no timestamp_field`);

	return {
		levelField: index.fields.some((f) => f.name === settings.levelField) ? settings.levelField : '',
		timestampField: index.timestampField,
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields ?? DEFAULT_CONTEXT_FIELDS
	};
}

export async function getIndexConfig(
	db: Db,
	qw: QuickwitClient,
	indexId: string,
	role: string | null | undefined
): Promise<IndexConfig> {
	const meta = await getIndexMeta(db, qw, indexId, role, 'search');
	return { indexId, ...resolveLogFields(meta) };
}

export function getIndexViewConfig(meta: IndexMeta): IndexViewConfig {
	return {
		indexId: meta.index.indexId,
		displayName: meta.settings.displayName,
		...resolveLogFields(meta),
		isOtel: meta.index.indexId.startsWith('otel-')
	};
}

export function getIndexDetail(meta: IndexMeta): IndexDetail {
	const { settings, index } = meta;
	return {
		indexId: index.indexId,
		displayName: settings.displayName,
		visibility: settings.visibility,
		levelField: settings.levelField,
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields,
		indexUri: index.indexUri,
		timestampField: index.timestampField,
		mode: index.mode,
		partitionKey: index.partitionKey,
		maxNumPartitions: index.maxNumPartitions,
		dynamicMapping: index.dynamicMapping,
		tagFields: index.tagFields,
		defaultSearchFields: index.defaultSearchFields,
		storeSource: index.storeSource,
		indexFieldPresence: index.indexFieldPresence,
		commitTimeoutSecs: index.commitTimeoutSecs,
		retention: index.retention,
		fields: index.fields,
		sources: index.sources.map((source) => ({
			sourceId: source.sourceId,
			sourceType: source.sourceType,
			enabled: source.enabled
		}))
	};
}

export async function deleteIndex(db: Db, qw: QuickwitClient, indexId: string): Promise<void> {
	await withNotFound(() => qw.deleteIndex(indexId), 'Index not found');

	await db.transaction(async (tx) => {
		await tx.delete(indexSettings).where(eq(indexSettings.indexId, indexId));
		await tx.delete(indexStatsSnapshot).where(eq(indexStatsSnapshot.indexId, indexId));
		await tx.delete(userPreference).where(eq(userPreference.indexId, indexId));
		await tx.delete(viewTable).where(eq(viewTable.indexId, indexId));
		await tx.delete(share).where(eq(share.indexId, indexId));
		await tx.delete(apiKey).where(eq(apiKey.indexId, indexId));
		await tx.delete(searchAudit).where(eq(searchAudit.indexId, indexId));
	});

	invalidateApiKeyCache();
}

const QUICKWIT_INDEX_CONFIG_VERSION = '0.9';

function toRetention(r: { period: string; schedule?: string | null }) {
	return r.schedule ? { period: r.period, schedule: r.schedule } : { period: r.period };
}

const DYNAMIC_MAPPING_DEFAULTS: DynamicMapping = {
	indexed: true,
	stored: true,
	fast: true,
	tokenizer: 'raw',
	record: 'basic',
	expandDots: true
};

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

// Mirrors the edit form's pre-fill fallbacks (toDynamicMappingForm) so an untouched
// form round-trips as "unchanged" even when the stored config holds values outside
// our picklists — otherwise a save would silently rewrite them.
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

type QwFieldMapping = FieldMapping & { coerce?: boolean; expand_dots?: boolean };

const FIELD_KEY_RENAME: Record<string, string> = {
	inputFormats: 'input_formats',
	outputFormat: 'output_format',
	fastPrecision: 'fast_precision',
	expandDots: 'expand_dots'
};

function toFieldMapping(input: FieldMappingInput, timestampField: string): QwFieldMapping {
	const fm: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (value !== undefined) fm[FIELD_KEY_RENAME[key] ?? key] = value;
	}
	if (input.name === timestampField) fm.fast = true;

	return fm as unknown as QwFieldMapping;
}

function toCreateIndexRequest(input: CreateIndexInput): CreateIndexRequest {
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

export async function createIndex(
	qw: QuickwitClient,
	input: CreateIndexInput
): Promise<IndexSummary> {
	let created: IndexMetadata;
	try {
		created = await qw.createIndex(toCreateIndexRequest(input));
	} catch (err) {
		if (err instanceof QuickwitError) {
			const e = err as QuickwitError;
			if (e.status === 409 || /already exists/i.test(e.message)) {
				throw conflict('An index with this ID already exists.', 'INDEX_EXISTS', [
					{ path: 'indexId', message: 'An index with this ID already exists.' }
				]);
			}
		}
		translateQuickwitError(err);
	}

	return toIndexSummary(normalizeIndexMetadata(created), DEFAULT_SETTINGS);
}

function sameStringSet(a: string[], b: string[]): boolean {
	return new Set(a).symmetricDifference(new Set(b)).size === 0;
}

export async function updateIndexConfig(
	qw: QuickwitClient,
	indexId: string,
	existingFields: IndexField[],
	input: UpdateQuickwitConfigInput
): Promise<void> {
	// Explicit type arg: quickwit-js d.ts imports are extensionless, so its types
	// degrade to error-types under NodeNext and generic inference yields unknown.
	const meta = await withNotFound<IndexMetadata>(() => qw.getIndex(indexId), 'Index not found');
	const cfg = meta.index_config;
	const doc = cfg.doc_mapping;

	const existingNames = new Set<string>([
		...doc.field_mappings.map((f: FieldMapping) => f.name),
		...existingFields.map((f) => f.name)
	]);
	const collisions = input.newFieldMappings
		.map((f, i) => ({ name: f.name, i }))
		.filter((f) => existingNames.has(f.name));
	if (collisions.length > 0) {
		throw conflict(
			'A field with this name already exists.',
			'FIELD_EXISTS',
			collisions.map((c) => ({
				path: `newFieldMappings.${c.i}.name`,
				message: 'A field with this name already exists.'
			}))
		);
	}

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
				...doc.field_mappings,
				...input.newFieldMappings.map((f) => toFieldMapping(f, ts))
			]
		};
		// Untouched dynamic mapping keeps the raw stored value (via the doc spread) so
		// config our UI can't represent (custom tokenizers, fast normalizer objects)
		// survives unrelated doc edits. Non-dynamic mode always drops it.
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

	// PUT is full-replacement: start from the raw config so unmodeled top-level
	// fields (e.g. ingest_settings on newer Quickwit) survive, then override only
	// the controlled pieces. The runtime spread copies props TS doesn't model.
	const request = { ...cfg } as CreateIndexRequest;
	if (!request.version) request.version = QUICKWIT_INDEX_CONFIG_VERSION;
	request.doc_mapping = docMapping;

	if (Object.keys(searchSettings).length > 0) request.search_settings = searchSettings;
	else delete request.search_settings;

	if (Object.keys(indexingSettings).length > 0) request.indexing_settings = indexingSettings;
	else delete request.indexing_settings;

	if (input.retention) request.retention = toRetention(input.retention);
	else delete request.retention;

	try {
		await qw.updateIndex(indexId, request);
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		translateQuickwitError(err);
	}
}
