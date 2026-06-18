import { eq, inArray } from 'drizzle-orm';
import type {
	IndexConfig,
	IndexDetail,
	IndexField,
	IndexMeta,
	IndexSettings,
	IndexSource,
	IndexSummary,
	IndexView,
	IndexViewConfig,
	IndexVisibility,
	QuickwitIndexMetadata,
	SaveIndexConfigFields,
	SourceDetail
} from '../types.js';
import {
	NotFoundError,
	QuickwitError,
	type CreateIndexRequest,
	type DocMapping,
	type FieldMapping,
	type IndexMetadata,
	type QuickwitClient,
	type SourceConfig
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
import { translateQuickwitError } from '../utils/quickwit-error.js';
import { invalidateApiKeyCache } from './api-key.service.js';
import type { CreateSourceInput, UpdateSourceInput } from '../schemas/sources.js';
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

async function withNotFound<T>(fn: () => Promise<T>, message: string): Promise<T> {
	try {
		return await fn();
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound(message);
		throw err;
	}
}

export async function setSourceEnabled(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string,
	enabled: boolean
): Promise<void> {
	await withNotFound(() => qw.index(indexId).toggleSource(sourceId, enabled), 'Source not found');
}

export async function deleteSource(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<void> {
	await withNotFound(() => qw.index(indexId).deleteSource(sourceId), 'Source not found');
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

const QUICKWIT_SOURCE_CONFIG_VERSION = '0.9';
const QUICKWIT_INDEX_CONFIG_VERSION = '0.9';

type QwFieldMapping = FieldMapping & { coerce?: boolean; expand_dots?: boolean };

function toSourceConfig(sourceId: string, input: UpdateSourceInput): SourceConfig {
	const base = {
		version: QUICKWIT_SOURCE_CONFIG_VERSION,
		source_id: sourceId,
		source_type: input.sourceType,
		...(input.inputFormat ? { input_format: input.inputFormat } : {}),
		...(input.numPipelines ? { num_pipelines: input.numPipelines } : {}),
		...(input.vrlScript ? { transform: { script: input.vrlScript } } : {})
	};

	switch (input.sourceType) {
		case 'kinesis':
			return {
				...base,
				params: {
					stream_name: input.streamName,
					...(input.region ? { region: input.region } : {}),
					...(input.endpoint ? { endpoint: input.endpoint } : {})
				}
			} as SourceConfig;
		case 'file':
			return {
				...base,
				params: {
					notifications: [
						{ type: 'sqs', queue_url: input.queueUrl, message_type: input.messageType }
					]
				}
			} as SourceConfig;
		case 'kafka':
			return {
				...base,
				params: {
					topic: input.topic,
					...(input.clientLogLevel ? { client_log_level: input.clientLogLevel } : {}),
					...(input.clientParams ? { client_params: input.clientParams } : {}),
					enable_backfill_mode: input.enableBackfillMode ?? false
				}
			} as SourceConfig;
	}
}

export async function createSource(
	qw: QuickwitClient,
	indexId: string,
	input: CreateSourceInput
): Promise<IndexSource> {
	let created: SourceConfig;
	try {
		created = await qw.index(indexId).createSource(toSourceConfig(input.sourceId, input));
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		if (err instanceof QuickwitError) {
			const e = err as QuickwitError;
			if (e.status === 409 || /already (exists|used)/i.test(e.message)) {
				throw conflict('A source with this ID already exists.', 'SOURCE_EXISTS', [
					{ path: 'sourceId', message: 'A source with this ID already exists.' }
				]);
			}
		}
		translateQuickwitError(err);
	}

	return {
		sourceId: created.source_id,
		sourceType: created.source_type,
		enabled: created.enabled ?? true
	};
}

const SECRET_MASK = '••••••';
const SECRET_KEY = /password|secret/i;

function redactSecrets(params: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(params)) {
		out[key] = SECRET_KEY.test(key) ? SECRET_MASK : value;
	}
	return out;
}

// Swap masked values back to the stored secret so editing other fields doesn't clobber it.
function restoreSecrets(
	incoming: Record<string, unknown>,
	stored: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(incoming)) {
		if (value === SECRET_MASK) {
			if (key in stored) out[key] = stored[key];
		} else {
			out[key] = value;
		}
	}
	return out;
}

export function projectSource(index: QuickwitIndexMetadata, sourceId: string): SourceDetail {
	const source = index.sources.find((s) => s.sourceId === sourceId);
	if (!source) throw notFound('Source not found');

	const params = (source.params ?? {}) as Record<string, unknown>;
	const notifications = (params.notifications as Array<Record<string, unknown>> | undefined) ?? [];
	const firstNotification = notifications[0] ?? {};
	const hasUnsupportedConfig =
		notifications.length > 1 || notifications.some((n) => n.type !== 'sqs');

	const clientParams =
		params.client_params != null &&
		typeof params.client_params === 'object' &&
		!Array.isArray(params.client_params)
			? redactSecrets(params.client_params as Record<string, unknown>)
			: null;

	return {
		sourceId: source.sourceId,
		sourceType: source.sourceType,
		enabled: source.enabled,
		inputFormat: source.inputFormat,
		numPipelines: source.numPipelines,
		streamName: typeof params.stream_name === 'string' ? params.stream_name : null,
		region: typeof params.region === 'string' ? params.region : null,
		endpoint: typeof params.endpoint === 'string' ? params.endpoint : null,
		queueUrl: typeof firstNotification.queue_url === 'string' ? firstNotification.queue_url : null,
		messageType:
			typeof firstNotification.message_type === 'string' ? firstNotification.message_type : null,
		topic: typeof params.topic === 'string' ? params.topic : null,
		clientLogLevel: typeof params.client_log_level === 'string' ? params.client_log_level : null,
		clientParams,
		enableBackfillMode:
			typeof params.enable_backfill_mode === 'boolean' ? params.enable_backfill_mode : null,
		vrlScript: source.vrlScript,
		hasUnsupportedConfig
	};
}

async function getRawSourceConfig(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<SourceConfig> {
	const meta = await qw.getIndex(indexId).catch((err: unknown) => {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		throw err;
	});
	const source = (meta.sources ?? []).find((s: SourceConfig) => s.source_id === sourceId);
	if (!source) throw notFound('Source not found');
	return source;
}

function mergeSourceConfig(
	current: SourceConfig,
	sourceId: string,
	input: UpdateSourceInput
): SourceConfig {
	const merged: SourceConfig = {
		...current,
		version: QUICKWIT_SOURCE_CONFIG_VERSION,
		source_id: sourceId,
		source_type: input.sourceType,
		enabled: current.enabled ?? true
	};

	if (input.inputFormat) merged.input_format = input.inputFormat;
	else delete merged.input_format;

	if (input.numPipelines) merged.num_pipelines = input.numPipelines;
	else delete merged.num_pipelines;

	if (input.vrlScript) {
		merged.transform = { ...current.transform, script: input.vrlScript };
	} else {
		delete merged.transform;
	}

	const currentParams = (current.params ?? {}) as Record<string, unknown>;
	switch (input.sourceType) {
		case 'kinesis':
			merged.params = {
				...currentParams,
				stream_name: input.streamName,
				...(input.region ? { region: input.region } : {}),
				...(input.endpoint ? { endpoint: input.endpoint } : {})
			};
			break;
		case 'file':
			merged.params = {
				...currentParams,
				notifications: [{ type: 'sqs', queue_url: input.queueUrl, message_type: input.messageType }]
			};
			break;
		case 'kafka': {
			const storedClientParams =
				currentParams.client_params != null &&
				typeof currentParams.client_params === 'object' &&
				!Array.isArray(currentParams.client_params)
					? (currentParams.client_params as Record<string, unknown>)
					: {};
			const clientParams = input.clientParams
				? restoreSecrets(input.clientParams, storedClientParams)
				: undefined;
			merged.params = {
				topic: input.topic,
				...(input.clientLogLevel ? { client_log_level: input.clientLogLevel } : {}),
				...(clientParams ? { client_params: clientParams } : {}),
				enable_backfill_mode: input.enableBackfillMode ?? false
			};
			break;
		}
	}

	return merged;
}

export async function updateSource(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string,
	input: UpdateSourceInput
): Promise<SourceDetail> {
	const current = await getRawSourceConfig(qw, indexId, sourceId);
	const merged = mergeSourceConfig(current, sourceId, input);
	try {
		await qw.index(indexId).updateSource(sourceId, merged);
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Source not found');
		translateQuickwitError(err);
	}
	const index = await qwGetIndex(qw, indexId);
	if (!index) throw notFound('Index not found');
	return projectSource(index, sourceId);
}

export async function resetSourceCheckpoint(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<void> {
	await withNotFound(() => qw.index(indexId).resetSourceCheckpoint(sourceId), 'Source not found');
}

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
	if (a.length !== b.length) return false;
	const setA = new Set(a);
	return b.every((x) => setA.has(x));
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
		delete docMapping.doc_mapping_uid;
	} else {
		docMapping = doc;
	}

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
