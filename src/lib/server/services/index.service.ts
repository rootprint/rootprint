import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { indexesMeta } from '$lib/server/db/schema';
import { getIndexMetadata, listIndexMetadata } from '$lib/server/services/quickwit-index.service';
import {
	type AdminIndexDetail,
	type AdminIndexSummary,
	canAccessIndex,
	type IndexVisibility,
	type QuickwitField,
	type SaveIndexConfigFields
} from '$lib/types';

const OTEL_INDEX_PREFIX = 'otel-logs-';

type MetaDefaults = {
	displayName: string | null;
	visibility: IndexVisibility;
	levelField: string;
	messageField: string;
	tracebackField: string | null;
	contextFields: string[] | null;
};

function defaultsFor(indexId: string): MetaDefaults {
	if (indexId.startsWith(OTEL_INDEX_PREFIX)) {
		return {
			displayName: null,
			visibility: 'all',
			levelField: 'severity_text',
			messageField: 'body',
			tracebackField: 'attributes.exception.stacktrace',
			contextFields: null
		};
	}
	return {
		displayName: null,
		visibility: 'all',
		levelField: 'level',
		messageField: 'message',
		tracebackField: null,
		contextFields: null
	};
}

type MetaRow = typeof indexesMeta.$inferSelect;

function readMetaRow(indexId: string): MetaRow | undefined {
	const [row] = db.select().from(indexesMeta).where(eq(indexesMeta.indexId, indexId)).all();
	return row;
}

function readMetaMap(): Map<string, MetaRow> {
	return new Map(
		db
			.select()
			.from(indexesMeta)
			.all()
			.map((r) => [r.indexId, r])
	);
}

function metaWithDefaults(indexId: string): MetaDefaults {
	const row = readMetaRow(indexId);
	const defaults = defaultsFor(indexId);
	if (!row) return defaults;
	return {
		displayName: row.displayName ?? defaults.displayName,
		visibility: row.visibility,
		levelField: row.levelField,
		messageField: row.messageField,
		tracebackField: row.tracebackField ?? defaults.tracebackField,
		contextFields: row.contextFields ?? defaults.contextFields
	};
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

export async function getAdminIndexSummaries(): Promise<AdminIndexSummary[]> {
	const live = await listIndexMetadata();
	const metaMap = readMetaMap();

	return live.map((m) => {
		const meta = metaMap.get(m.indexId);
		return {
			indexId: m.indexId,
			displayName: meta?.displayName ?? null,
			fieldCount: m.fields.length,
			sourceCount: m.sources.length,
			mode: m.mode,
			createTimestamp: m.createTimestamp,
			visibility: meta?.visibility ?? 'all'
		};
	});
}

export async function getIndexes(userRole: string | null | undefined) {
	const live = await listIndexMetadata();
	const metaMap = readMetaMap();

	const isAdmin = userRole === 'admin';
	return live
		.map((m) => {
			const meta = metaMap.get(m.indexId);
			return {
				indexId: m.indexId,
				indexUri: m.indexUri ?? '',
				displayName: meta?.displayName ?? null,
				visibility: meta?.visibility ?? 'all'
			};
		})
		.filter((i) => canAccessIndex(i.visibility, isAdmin));
}

export async function getAdminIndexIds(): Promise<string[]> {
	const live = await listIndexMetadata();
	return live.map((m) => m.indexId);
}

export async function getFieldConfig(indexId: string) {
	const meta = metaWithDefaults(indexId);
	const live = await getIndexMetadata(indexId);
	const fields = live?.fields ?? [];

	return {
		indexId,
		levelField: meta.levelField,
		timestampField: live?.timestampField ?? 'timestamp',
		messageField: meta.messageField,
		tracebackField: meta.tracebackField,
		contextFields: meta.contextFields,
		fastFieldNames: strictFastFieldNames(fields),
		fastJsonFields: fastJsonFieldNames(fields)
	};
}

export async function getIndexFields(indexId: string) {
	const live = await getIndexMetadata(indexId);
	if (!live) return { fields: [] };

	return {
		fields: live.fields.map((f) => ({
			name: f.name,
			type: f.type,
			fast: isFastField(f)
		}))
	};
}

export async function saveIndexConfig(indexId: string, fields: SaveIndexConfigFields) {
	const defaults = defaultsFor(indexId);
	const provided = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
	const updatedAt = new Date();
	await db
		.insert(indexesMeta)
		.values({
			indexId,
			levelField: defaults.levelField,
			messageField: defaults.messageField,
			tracebackField: defaults.tracebackField,
			...provided,
			updatedAt
		})
		.onConflictDoUpdate({
			target: indexesMeta.indexId,
			set: { ...provided, updatedAt }
		});
}

export async function getAdminIndexDetail(indexId: string): Promise<AdminIndexDetail | null> {
	const live = await getIndexMetadata(indexId);
	if (!live) return null;

	const meta = metaWithDefaults(indexId);

	return {
		indexId: live.indexId,
		indexUid: live.indexUid,
		indexUri: live.indexUri,
		version: live.version,
		createTimestamp: live.createTimestamp,
		timestampField: live.timestampField,
		mode: live.mode,
		indexFieldPresence: live.indexFieldPresence,
		storeSource: live.storeSource,
		storeDocumentSize: live.storeDocumentSize,
		tagFields: live.tagFields,
		defaultSearchFields: live.defaultSearchFields,
		retention: live.retention,
		levelField: meta.levelField,
		messageField: meta.messageField,
		tracebackField: meta.tracebackField,
		displayName: meta.displayName,
		visibility: meta.visibility,
		contextFields: meta.contextFields,
		fields: live.fields,
		sources: live.sources
	};
}

export async function assertIndexAccess(
	indexId: string,
	userRole: string | null | undefined
): Promise<void> {
	const isAdmin = userRole === 'admin';
	const visibility = readMetaRow(indexId)?.visibility ?? 'all';
	if (!canAccessIndex(visibility, isAdmin)) error(403, 'Index not accessible');

	const live = await getIndexMetadata(indexId);
	if (!live) error(403, 'Index not accessible');
}
