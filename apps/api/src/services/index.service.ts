import { eq, inArray } from 'drizzle-orm';

import type {
	IndexConfig,
	IndexDetail,
	IndexField,
	IndexMeta,
	IndexSettings,
	IndexSummary,
	IndexViewConfig
} from '../types.js';
import { NotFoundError, QuickwitError, QuickwitErrorCode, type QuickwitClient } from 'quickwit-js';

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
import { config } from '../config.js';
import { conflict, internal, notFound } from '../utils/http-error.js';
import { translateQuickwitError, withNotFound } from '../utils/quickwit-error.js';
import { invalidateApiKeyCache } from './api-key.service.js';
import type {
	CreateIndexInput,
	SaveIndexConfigInput,
	UpdateQuickwitConfigInput
} from '../schemas/indexes.js';
import { getIndex as qwGetIndex, listIndexes as qwListIndexes } from './quickwit-index.service.js';
import {
	findFieldCollisions,
	toCreateIndexRequest,
	toUpdateIndexRequest
} from './quickwit-index-config.js';

const DEFAULT_SETTINGS: IndexSettings = {
	displayName: null,
	levelField: 'severity_text',
	messageField: 'body.message',
	tracebackField: 'attributes.exception.stacktrace',
	contextFields: null,
	traceIdField: 'trace_id'
};

const DEFAULT_CONTEXT_FIELDS = ['service_name'];

function toIndexSettings(row: typeof indexSettings.$inferSelect): IndexSettings {
	return {
		displayName: row.displayName,
		levelField: row.levelField,
		messageField: row.messageField,
		tracebackField: row.tracebackField,
		contextFields: row.contextFields,
		traceIdField: row.traceIdField
	};
}

async function getIndexSettings(db: Db, indexId: string): Promise<IndexSettings> {
	const [row] = await db
		.select()
		.from(indexSettings)
		.where(eq(indexSettings.indexId, indexId))
		.limit(1);

	if (!row) return DEFAULT_SETTINGS;

	return toIndexSettings(row);
}

export async function saveIndexConfig(
	db: Db,
	indexId: string,
	existing: IndexSettings,
	fields: SaveIndexConfigInput
): Promise<void> {
	const updatedAt = new Date();
	await db
		.insert(indexSettings)
		.values({ indexId, ...existing, ...fields, updatedAt })
		.onConflictDoUpdate({
			target: indexSettings.indexId,
			set: { ...fields, updatedAt }
		});
}

function toIndexSummary(indexId: string, settings: IndexSettings): IndexSummary {
	return {
		indexId,
		displayName: settings.displayName,
		// Derived, not stored: the span store is whichever index `config.traceIndexId` names.
		isTraceIndex: indexId === config.traceIndexId
	};
}

export async function listIndexes(db: Db, qw: QuickwitClient): Promise<IndexSummary[]> {
	const indexes = await qwListIndexes(qw);

	const ids = indexes.map((m) => m.indexId);
	const rows = ids.length
		? await db.select().from(indexSettings).where(inArray(indexSettings.indexId, ids))
		: [];
	const settingsMap = new Map<string, IndexSettings>(
		rows.map((r) => [r.indexId, toIndexSettings(r)])
	);

	return indexes.map((m) =>
		toIndexSummary(m.indexId, settingsMap.get(m.indexId) ?? DEFAULT_SETTINGS)
	);
}

/** The span store has no level or message field, so every log-index route must refuse it. */
export function assertNotTraceIndex(indexId: string): void {
	if (indexId === config.traceIndexId) throw notFound('Index not found', 'INDEX_NOT_FOUND');
}

export async function getIndexMeta(
	db: Db,
	qw: QuickwitClient,
	indexId: string
): Promise<IndexMeta> {
	const [settings, index] = await Promise.all([
		getIndexSettings(db, indexId),
		qwGetIndex(qw, indexId)
	]);
	if (!index) throw notFound('Index not found', 'INDEX_NOT_FOUND');
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
	indexId: string
): Promise<IndexConfig> {
	// A span schema has no level or message field, so the explorer would render an empty grid.
	assertNotTraceIndex(indexId);
	const meta = await getIndexMeta(db, qw, indexId);
	// resolveLogFields also yields traceback/context fields for the view config; IndexConfig
	// narrows them away because no log or export consumer reads them.
	return { indexId, ...resolveLogFields(meta) };
}

export function getIndexViewConfig(meta: IndexMeta): IndexViewConfig {
	return {
		indexId: meta.index.indexId,
		displayName: meta.settings.displayName,
		...resolveLogFields(meta),
		isOtel: meta.index.indexId.startsWith('otel-'),
		traceIdField: meta.settings.traceIdField
	};
}

export function getIndexDetail(meta: IndexMeta): IndexDetail {
	const { settings, index } = meta;
	return {
		indexId: index.indexId,
		displayName: settings.displayName,
		isTraceIndex: index.indexId === config.traceIndexId,
		levelField: settings.levelField,
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields,
		traceIdField: settings.traceIdField,
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

export async function createIndex(
	qw: QuickwitClient,
	input: CreateIndexInput
): Promise<IndexSummary> {
	try {
		await qw.createIndex(toCreateIndexRequest(input));
	} catch (err) {
		if (err instanceof QuickwitError) {
			if (err.code === QuickwitErrorCode.CONFLICT || /already exists/i.test(err.message)) {
				throw conflict('An index with this ID already exists.', 'INDEX_EXISTS', [
					{ path: 'indexId', message: 'An index with this ID already exists.' }
				]);
			}
		}
		translateQuickwitError(err);
	}

	return toIndexSummary(input.indexId, DEFAULT_SETTINGS);
}

export async function updateIndexConfig(
	qw: QuickwitClient,
	indexId: string,
	existingFields: IndexField[],
	input: UpdateQuickwitConfigInput
): Promise<void> {
	const meta = await withNotFound(() => qw.getIndex(indexId), 'Index not found');

	const collisions = findFieldCollisions(meta.index_config, existingFields, input.newFieldMappings);
	if (collisions.length > 0) {
		throw conflict(
			'A field with this name already exists.',
			'FIELD_EXISTS',
			collisions.map((i) => ({
				path: `newFieldMappings.${i}.name`,
				message: 'A field with this name already exists.'
			}))
		);
	}

	try {
		await qw.updateIndex(indexId, toUpdateIndexRequest(meta.index_config, input));
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Index not found');
		translateQuickwitError(err);
	}
}
