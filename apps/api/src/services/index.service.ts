import { eq, inArray } from 'drizzle-orm';
import type {
	IndexConfig,
	IndexDetail,
	IndexField,
	IndexSettings,
	IndexSource,
	IndexSummary,
	IndexViewConfig,
	IndexVisibility,
	SaveIndexConfigFields,
	SourceDetail
} from '../types.js';
import { NotFoundError, QuickwitError, type QuickwitClient, type SourceConfig } from 'quickwit-js';

import type { Db } from '../db/index.js';
import {
	apiKey,
	indexSettings,
	indexStatsSnapshot,
	savedQuery,
	searchAudit,
	share,
	userPreference,
	view
} from '../db/schema.js';
import { conflict, indexAccessError, internal, notFound } from '../utils/http-error.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';
import { invalidateApiKeyCache } from './api-key.service.js';
import type { CreateSourceInput, UpdateSourceInput } from '../schemas/sources.js';
import { getIndex as qwGetIndex, listIndexes as qwListIndexes } from './quickwit-index.service.js';

const DEFAULT_SETTINGS: IndexSettings = {
	displayName: null,
	visibility: 'all',
	levelField: 'severity_text',
	messageField: 'body.message',
	tracebackField: 'attributes.exception.stacktrace',
	contextFields: null
};

export async function getIndexSettings(db: Db, indexId: string): Promise<IndexSettings> {
	const [row] = await db
		.select()
		.from(indexSettings)
		.where(eq(indexSettings.indexId, indexId))
		.limit(1);

	if (!row) return DEFAULT_SETTINGS;

	return {
		displayName: row.displayName,
		visibility: row.visibility,
		levelField: row.levelField,
		messageField: row.messageField,
		tracebackField: row.tracebackField,
		contextFields: row.contextFields
	};
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

export async function listIndexes(
	db: Db,
	qw: QuickwitClient,
	role: string | null | undefined,
	opts: { includeHidden?: boolean } = {}
): Promise<IndexSummary[]> {
	const indexes = await qwListIndexes(qw);
	const isAdmin = role === 'admin';
	const includeHidden = opts.includeHidden === true && isAdmin;

	const ids = indexes.map((m) => m.indexId);
	const rows = ids.length
		? await db.select().from(indexSettings).where(inArray(indexSettings.indexId, ids))
		: [];
	const settingsMap = new Map<string, IndexSettings>(
		rows.map((r) => [
			r.indexId,
			{
				displayName: r.displayName,
				visibility: r.visibility,
				levelField: r.levelField,
				messageField: r.messageField,
				tracebackField: r.tracebackField,
				contextFields: r.contextFields
			}
		])
	);

	return indexes
		.map((m) => {
			const s = settingsMap.get(m.indexId) ?? DEFAULT_SETTINGS;
			return {
				indexId: m.indexId,
				displayName: s.displayName,
				visibility: s.visibility,
				fieldCount: m.fields.length,
				sourceCount: m.sources.length,
				mode: m.mode,
				createTimestamp: m.createTimestamp
			};
		})
		.filter((m) => includeHidden || canAccessIndex(m.visibility, isAdmin));
}

export async function getIndexFields(
	qw: QuickwitClient,
	indexId: string
): Promise<{ fields: IndexField[] }> {
	const index = await qwGetIndex(qw, indexId);
	return { fields: index?.fields ?? [] };
}

export async function getIndexConfig(
	db: Db,
	qw: QuickwitClient,
	indexId: string,
	isAdmin: boolean
): Promise<IndexConfig> {
	const [settings, index] = await Promise.all([
		getIndexSettings(db, indexId),
		qwGetIndex(qw, indexId)
	]);

	if (!canAccessIndex(settings.visibility, isAdmin)) {
		throw indexAccessError(isAdmin, 'denied');
	}
	if (!index) throw indexAccessError(isAdmin, 'missing');
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

export async function getIndexViewConfig(
	db: Db,
	qw: QuickwitClient,
	indexId: string,
	isAdmin: boolean
): Promise<IndexViewConfig> {
	const [settings, index] = await Promise.all([
		getIndexSettings(db, indexId),
		qwGetIndex(qw, indexId)
	]);
	if (!canAccessIndex(settings.visibility, isAdmin)) {
		throw indexAccessError(isAdmin, 'denied');
	}
	if (!index) throw indexAccessError(isAdmin, 'missing');
	if (!index.timestampField) throw internal(`Index "${indexId}" has no timestamp_field`);

	return {
		indexId,
		displayName: settings.displayName,
		levelField: index.fields.some((f) => f.name === settings.levelField) ? settings.levelField : '',
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields,
		timestampField: index.timestampField,
		isOtel: indexId.startsWith('otel-')
	};
}

export async function getIndexDetail(
	db: Db,
	qw: QuickwitClient,
	indexId: string
): Promise<IndexDetail | null> {
	const [settings, index] = await Promise.all([
		getIndexSettings(db, indexId),
		qwGetIndex(qw, indexId)
	]);

	if (!index) return null;

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
		await tx.delete(savedQuery).where(eq(savedQuery.indexId, indexId));
		await tx.delete(view).where(eq(view.indexId, indexId));
		await tx.delete(share).where(eq(share.indexId, indexId));
		await tx.delete(apiKey).where(eq(apiKey.indexId, indexId));
		await tx.delete(searchAudit).where(eq(searchAudit.indexId, indexId));
	});

	invalidateApiKeyCache();
}

export async function assertIndexAccess(
	db: Db,
	qw: QuickwitClient,
	indexId: string,
	isAdmin: boolean
): Promise<void> {
	const [settings, index] = await Promise.all([
		getIndexSettings(db, indexId),
		qwGetIndex(qw, indexId)
	]);
	if (!canAccessIndex(settings.visibility, isAdmin)) {
		throw indexAccessError(isAdmin, 'denied');
	}
	if (!index) {
		throw indexAccessError(isAdmin, 'missing');
	}
}

export async function assertIndexManageable(
	qw: QuickwitClient,
	indexId: string,
	isAdmin: boolean
): Promise<void> {
	const index = await qwGetIndex(qw, indexId);
	if (!index) {
		throw indexAccessError(isAdmin, 'missing');
	}
}

// Quickwit deserializes source create/update request bodies as a
// `VersionedSourceConfig`, which REQUIRES a `version` field (enum "0.9" | "0.7"
// on Quickwit 0.9). Omitting it fails with "invalid config: missing version".
// Bump this to match the Quickwit server's source-config format version.
const QUICKWIT_SOURCE_CONFIG_VERSION = '0.9';

function toSourceConfig(sourceId: string, input: UpdateSourceInput): SourceConfig {
	const base = {
		version: QUICKWIT_SOURCE_CONFIG_VERSION,
		source_id: sourceId,
		source_type: input.sourceType,
		...(input.inputFormat ? { input_format: input.inputFormat } : {}),
		...(input.numPipelines ? { num_pipelines: input.numPipelines } : {}),
		...(input.vrlScript ? { transform: { script: input.vrlScript } } : {})
	};

	if (input.sourceType === 'kinesis') {
		return {
			...base,
			params: {
				stream_name: input.streamName,
				...(input.region ? { region: input.region } : {}),
				...(input.endpoint ? { endpoint: input.endpoint } : {})
			}
		} as SourceConfig;
	}

	return {
		...base,
		params: {
			notifications: [{ type: 'sqs', queue_url: input.queueUrl, message_type: input.messageType }]
		}
	} as SourceConfig;
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

export async function getSource(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<SourceDetail> {
	const index = await qwGetIndex(qw, indexId);
	if (!index) throw notFound('Index not found');

	const source = index.sources.find((s) => s.sourceId === sourceId);
	if (!source) throw notFound('Source not found');

	const params = (source.params ?? {}) as Record<string, unknown>;
	const notifications = (params.notifications as Array<Record<string, unknown>> | undefined) ?? [];
	const firstNotification = notifications[0] ?? {};
	const hasUnsupportedConfig =
		notifications.length > 1 || notifications.some((n) => n.type !== 'sqs');

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
	if (input.sourceType === 'kinesis') {
		merged.params = {
			...currentParams,
			stream_name: input.streamName,
			...(input.region ? { region: input.region } : {}),
			...(input.endpoint ? { endpoint: input.endpoint } : {})
		};
	} else {
		merged.params = {
			...currentParams,
			notifications: [{ type: 'sqs', queue_url: input.queueUrl, message_type: input.messageType }]
		};
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
	try {
		await qw.index(indexId).updateSource(sourceId, mergeSourceConfig(current, sourceId, input));
	} catch (err) {
		if (err instanceof NotFoundError) throw notFound('Source not found');
		translateQuickwitError(err);
	}
	return getSource(qw, indexId, sourceId);
}

export async function resetSourceCheckpoint(
	qw: QuickwitClient,
	indexId: string,
	sourceId: string
): Promise<void> {
	await withNotFound(() => qw.index(indexId).resetSourceCheckpoint(sourceId), 'Source not found');
}
