import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { NotFoundError } from 'quickwit-js';

import { db } from '$lib/server/db';
import {
	indexSettings,
	indexStatsSnapshot,
	ingestToken,
	savedQuery,
	searchHistory,
	sharedLink,
	userPreference
} from '$lib/server/db/schema';
import { quickwitClient } from '$lib/server/quickwit';
import {
	getIndex,
	listIndexIdsAndUris,
	listIndexSummaries
} from '$lib/server/services/quickwit-index.service';
import {
	type AdminIndexDetail,
	type AdminIndexSummary,
	type IndexVisibility,
	type QuickwitField,
	type SaveIndexConfigFields
} from '$lib/types';

function canAccessIndex(visibility: IndexVisibility, isAdmin: boolean): boolean {
	if (visibility === 'hidden') return false;
	if (visibility === 'admin') return isAdmin;
	return true;
}

type IndexSettings = {
	displayName: string | null;
	visibility: IndexVisibility;
	levelField: string;
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

type IndexSettingsRow = typeof indexSettings.$inferSelect;

function readIndexSettings(indexId: string): IndexSettings {
	const [row] = db.select().from(indexSettings).where(eq(indexSettings.indexId, indexId)).all();
	return row ?? DEFAULT_SETTINGS;
}

function readIndexSettingsMap(): Map<string, IndexSettingsRow> {
	return new Map(
		db
			.select()
			.from(indexSettings)
			.all()
			.map((r) => [r.indexId, r])
	);
}

// JSON fields are "fast" unless explicitly fast=false; other fields require fast=true.
function isFastField(f: QuickwitField): boolean {
	return f.type === 'json' ? f.fast !== false : f.fast === true;
}

function fastJsonFieldNames(fields: QuickwitField[]): string[] {
	return fields.filter((f) => f.type === 'json' && f.fast !== false).map((f) => f.name);
}

function strictFastFieldNames(fields: QuickwitField[]): string[] {
	return fields.filter((f) => f.fast === true).map((f) => f.name);
}

export async function listIndexesForAdmin(): Promise<AdminIndexSummary[]> {
	const summaries = await listIndexSummaries();
	const settingsMap = readIndexSettingsMap();

	return summaries.map((summary) => {
		const settings = settingsMap.get(summary.indexId);
		return {
			indexId: summary.indexId,
			displayName: settings?.displayName ?? null,
			fieldCount: summary.fieldCount,
			sourceCount: summary.sourceCount,
			mode: summary.mode,
			createTimestamp: summary.createTimestamp,
			visibility: settings?.visibility ?? 'all'
		};
	});
}

export async function listIndexesForUser(userRole: string | null | undefined) {
	const indexes = await listIndexIdsAndUris();
	const settingsMap = readIndexSettingsMap();

	const isAdmin = userRole === 'admin';
	return indexes
		.map((index) => {
			const settings = settingsMap.get(index.indexId);
			return {
				indexId: index.indexId,
				indexUri: index.indexUri ?? '',
				displayName: settings?.displayName ?? null,
				visibility: settings?.visibility ?? 'all'
			};
		})
		.filter((index) => canAccessIndex(index.visibility, isAdmin));
}

export async function getFieldConfig(indexId: string) {
	const settings = readIndexSettings(indexId);
	const index = await getIndex(indexId);
	const fields = index?.fields ?? [];

	return {
		indexId,
		levelField: settings.levelField,
		timestampField: index?.timestampField ?? 'timestamp',
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		contextFields: settings.contextFields,
		fastFieldNames: strictFastFieldNames(fields),
		fastJsonFields: fastJsonFieldNames(fields)
	};
}

export async function getIndexFields(indexId: string) {
	const index = await getIndex(indexId);
	if (!index) return { fields: [] };

	return {
		fields: index.fields.map((f) => ({
			name: f.name,
			type: f.type,
			fast: isFastField(f)
		}))
	};
}

export async function saveIndexConfig(indexId: string, fields: SaveIndexConfigFields) {
	const provided = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
	const updatedAt = new Date();
	await db
		.insert(indexSettings)
		.values({ indexId, ...provided, updatedAt })
		.onConflictDoUpdate({
			target: indexSettings.indexId,
			set: { ...provided, updatedAt }
		});
}

export async function getIndexForAdmin(indexId: string): Promise<AdminIndexDetail | null> {
	const index = await getIndex(indexId);
	if (!index) return null;

	const settings = readIndexSettings(indexId);

	return {
		indexId: index.indexId,
		indexUid: index.indexUid,
		indexUri: index.indexUri,
		version: index.version,
		createTimestamp: index.createTimestamp,
		timestampField: index.timestampField,
		mode: index.mode,
		indexFieldPresence: index.indexFieldPresence,
		storeSource: index.storeSource,
		storeDocumentSize: index.storeDocumentSize,
		tagFields: index.tagFields,
		defaultSearchFields: index.defaultSearchFields,
		retention: index.retention,
		levelField: settings.levelField,
		messageField: settings.messageField,
		tracebackField: settings.tracebackField,
		displayName: settings.displayName,
		visibility: settings.visibility,
		contextFields: settings.contextFields,
		fields: index.fields,
		sources: index.sources
	};
}

export async function assertIndexAccess(
	indexId: string,
	userRole: string | null | undefined
): Promise<void> {
	const isAdmin = userRole === 'admin';
	const { visibility } = readIndexSettings(indexId);
	if (!canAccessIndex(visibility, isAdmin)) error(403, 'Index not accessible');

	const index = await getIndex(indexId);
	if (!index) {
		if (isAdmin) error(404, 'Index not found');
		error(403, 'Index not accessible');
	}
}

export async function setSourceEnabled(
	indexId: string,
	sourceId: string,
	enabled: boolean
): Promise<void> {
	try {
		await quickwitClient.index(indexId).toggleSource(sourceId, enabled);
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Source not found');
		throw e;
	}
}

export async function resetSourceCheckpoint(indexId: string, sourceId: string): Promise<void> {
	try {
		await quickwitClient.index(indexId).resetSourceCheckpoint(sourceId);
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Source not found');
		throw e;
	}
}

export async function deleteSource(indexId: string, sourceId: string): Promise<void> {
	try {
		await quickwitClient.index(indexId).deleteSource(sourceId);
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Source not found');
		throw e;
	}
}

export async function deleteIndex(indexId: string): Promise<void> {
	try {
		await quickwitClient.deleteIndex(indexId);
	} catch (e) {
		if (e instanceof NotFoundError) error(404, 'Index not found');
		throw e;
	}

	try {
		db.transaction((tx) => {
			tx.delete(indexSettings).where(eq(indexSettings.indexId, indexId)).run();
			tx.delete(indexStatsSnapshot).where(eq(indexStatsSnapshot.indexId, indexId)).run();
			tx.delete(userPreference).where(eq(userPreference.indexName, indexId)).run();
			tx.delete(searchHistory).where(eq(searchHistory.indexName, indexId)).run();
			tx.delete(savedQuery).where(eq(savedQuery.indexName, indexId)).run();
			tx.delete(sharedLink).where(eq(sharedLink.indexName, indexId)).run();

			tx.delete(ingestToken).where(eq(ingestToken.indexId, indexId)).run();
		});
	} catch (e) {
		console.error(`[deleteIndex] local cleanup failed for ${indexId}:`, e);
	}
}
