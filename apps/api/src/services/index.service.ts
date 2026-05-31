import { eq, inArray } from 'drizzle-orm';
import type {
	IndexDetail,
	IndexField,
	IndexSummary,
	IndexViewConfig,
	IndexVisibility,
	SaveIndexConfigFields
} from '../types.js';
import { NotFoundError, type QuickwitClient } from 'quickwit-js';

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
import { indexAccessError, internal, notFound } from '../utils/http-error.js';
import { invalidateApiKeyCache } from './api-key.service.js';
import { getIndex as qwGetIndex, listIndexes as qwListIndexes } from './quickwit-index.service.js';

export type IndexSettings = {
	displayName: string | null;
	visibility: IndexVisibility;
	levelField: string;
	messageField: string;
	tracebackField: string | null;
	contextFields: string[] | null;
};

export type IndexConfig = {
	indexId: string;
	levelField: string;
	timestampField: string;
	messageField: string;
	tracebackField: string | null;
	contextFields: string[] | null;
};

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
		levelField: settings.levelField,
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
