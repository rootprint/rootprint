import { eq, inArray } from 'drizzle-orm';
import type {
	IndexConfig,
	IndexDetail,
	IndexField,
	IndexMeta,
	IndexSettings,
	IndexSummary,
	IndexView,
	IndexViewConfig,
	IndexVisibility,
	QuickwitIndexMetadata,
	SaveIndexConfigFields
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
import type {
	CreateIndexInput,
	FieldMappingInput,
	UpdateQuickwitConfigInput
} from '../schemas/indexes.js';
import {
	getIndex as qwGetIndex,
	listIndexes as qwListIndexes,
	normalizeIndexMetadata
} from './quickwit-index.service.js';

const DEFAULT_SETTINGS: IndexSettings = {
	displayName: null,
	visibility: 'all',
	levelField: 'severity_text',
	messageField: 'body.message',
	tracebackField: 'attributes.exception.stacktrace',
	contextFields: null
};

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

export async function assertIndexAccess(
	db: Db,
	indexId: string,
	role: string | null | undefined
): Promise<void> {
	const settings = await getIndexSettings(db, indexId);
	const isAdmin = role === 'admin';
	if (!canAccessIndex(settings.visibility, isAdmin)) throw indexAccessError(isAdmin, 'denied');
}

export async function saveIndexConfig(
	db: Db,
	indexId: string,
	fields: SaveIndexConfigFields
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

export async function getIndexConfig(
	db: Db,
	qw: QuickwitClient,
	indexId: string,
	role: string | null | undefined
): Promise<IndexConfig> {
	const { settings, index } = await getIndexMeta(db, qw, indexId, role, 'search');
	if (!index.timestampField) throw internal(`Index "${indexId}" has no timestamp_field`);

	return {
		indexId,
		levelField: index.fields.some((f) => f.name === settings.levelField) ? settings.levelField : '',
		timestampField: index.timestampField,
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields
	};
}

export function getIndexViewConfig(meta: IndexMeta): IndexViewConfig {
	const { settings, index } = meta;
	if (!index.timestampField) throw internal(`Index "${index.indexId}" has no timestamp_field`);

	return {
		indexId: index.indexId,
		displayName: settings.displayName,
		levelField: index.fields.some((f) => f.name === settings.levelField) ? settings.levelField : '',
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields,
		timestampField: index.timestampField,
		isOtel: index.indexId.startsWith('otel-')
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
	if (input.retention) {
		request.retention = input.retention.schedule
			? { period: input.retention.period, schedule: input.retention.schedule }
			: { period: input.retention.period };
	}

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
	const setA = new Set(a);
	const setB = new Set(b);
	return setA.size === setB.size && [...setA].every((x) => setB.has(x));
}

export async function updateIndexConfig(
	qw: QuickwitClient,
	indexId: string,
	existingFields: IndexField[],
	input: UpdateQuickwitConfigInput
): Promise<void> {
	const meta = await qw.getIndex(indexId).catch((err: unknown) => {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		throw err;
	});
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

	const docChanged =
		input.newFieldMappings.length > 0 ||
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

	if (input.retention) {
		request.retention = input.retention.schedule
			? { period: input.retention.period, schedule: input.retention.schedule }
			: { period: input.retention.period };
	} else {
		delete request.retention;
	}

	try {
		await qw.updateIndex(indexId, request);
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		translateQuickwitError(err);
	}
}
