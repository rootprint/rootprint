import { error } from '@sveltejs/kit';
import { and, count, eq, isNull, not, notInArray, or } from 'drizzle-orm';
import type { FieldMapping } from 'quickwit-js';

import { db } from '$lib/server/db';
import { qwFieldMapping, qwIndex, qwSource } from '$lib/server/db/schema';
import { getQuickwitClient } from '$lib/server/quickwit';
import type { IndexVisibility, SaveIndexConfigFields } from '$lib/types';

function flattenFieldMappings(
	mappings: FieldMapping[],
	prefix = ''
): {
	name: string;
	type: string;
	fast: boolean | undefined;
	indexed: boolean | undefined;
	stored: boolean | undefined;
	record: string | undefined;
	tokenizer: string | undefined;
}[] {
	const result: ReturnType<typeof flattenFieldMappings> = [];
	for (const f of mappings) {
		const fullName = prefix ? `${prefix}.${f.name}` : f.name;
		if (f.type === 'object' && f.field_mappings) {
			result.push(...flattenFieldMappings(f.field_mappings, fullName));
		} else {
			result.push({
				name: fullName,
				type: f.type,
				fast: f.fast,
				indexed: f.indexed,
				stored: f.stored,
				record: f.record,
				tokenizer: f.tokenizer
			});
		}
	}
	return result;
}

function getIndexSummaries() {
	const results = db
		.select({
			id: qwIndex.id,
			indexId: qwIndex.indexId,
			mode: qwIndex.mode,
			createTimestamp: qwIndex.createTimestamp,
			visibility: qwIndex.visibility
		})
		.from(qwIndex)
		.all();

	const fieldCounts = db
		.select({
			indexId: qwFieldMapping.indexId,
			count: count()
		})
		.from(qwFieldMapping)
		.groupBy(qwFieldMapping.indexId)
		.all();

	const sourceCounts = db
		.select({
			indexId: qwSource.indexId,
			count: count()
		})
		.from(qwSource)
		.groupBy(qwSource.indexId)
		.all();

	const fieldCountMap = new Map(fieldCounts.map((r) => [r.indexId, r.count]));
	const sourceCountMap = new Map(sourceCounts.map((r) => [r.indexId, r.count]));

	return results.map((r) => ({
		id: r.id,
		indexId: r.indexId,
		fieldCount: fieldCountMap.get(r.id) ?? 0,
		sourceCount: sourceCountMap.get(r.id) ?? 0,
		mode: r.mode,
		createTimestamp: r.createTimestamp,
		visibility: r.visibility
	}));
}

export function getFieldConfig(indexId: string) {
	const [row] = db
		.select({
			id: qwIndex.id,
			levelField: qwIndex.levelField,
			timestampField: qwIndex.timestampField,
			messageField: qwIndex.messageField,
			tracebackField: qwIndex.tracebackField,
			contextFields: qwIndex.contextFields,
			stickyFilterFields: qwIndex.stickyFilterFields
		})
		.from(qwIndex)
		.where(eq(qwIndex.indexId, indexId))
		.all();

	const internalId = row?.id ?? null;

	const fastJsonFields: string[] = [];
	if (internalId !== null) {
		const rows = db
			.select({ name: qwFieldMapping.name })
			.from(qwFieldMapping)
			.where(
				and(
					eq(qwFieldMapping.indexId, internalId),
					eq(qwFieldMapping.type, 'json'),
					or(eq(qwFieldMapping.fast, true), isNull(qwFieldMapping.fast))
				)
			)
			.all();
		for (const r of rows) {
			fastJsonFields.push(r.name);
		}
	}

	return {
		id: internalId,
		levelField: row?.levelField ?? 'level',
		timestampField: row?.timestampField ?? 'timestamp',
		messageField: row?.messageField ?? 'message',
		tracebackField: row?.tracebackField ?? null,
		contextFields: (row?.contextFields as string[] | null) ?? null,
		stickyFilterFields: (row?.stickyFilterFields as string[] | null) ?? [
			row?.levelField ?? 'level'
		],
		fastJsonFields
	};
}

// Quickwit API response objects have dynamic shapes - use Record<string, unknown>
// and let the DB schema handle type coercion on insert
function buildIndexValues(
	meta: Record<string, unknown>,
	cfg: Record<string, unknown>,
	doc: Record<string, unknown>
) {
	const searchSettings = cfg.search_settings as Record<string, unknown> | undefined;
	return {
		indexUid: meta.index_uid,
		indexUri: cfg.index_uri ?? null,
		version: cfg.version,
		createTimestamp: meta.create_timestamp ?? null,
		timestampField: doc.timestamp_field ?? null,
		partitionKey: doc.partition_key ?? null,
		maxNumPartitions: doc.max_num_partitions ?? 0,
		mode: doc.mode ?? null,
		indexFieldPresence: doc.index_field_presence ?? null,
		storeSource: doc.store_source ?? null,
		storeDocumentSize: doc.store_document_size ?? null,
		docMappingUid: doc.doc_mapping_uid ?? null,
		tagFields: doc.tag_fields ?? null,
		defaultSearchFields: searchSettings?.default_search_fields ?? null,
		dynamicMapping: doc.dynamic_mapping ?? null,
		tokenizers: doc.tokenizers ?? null,
		indexingSettings: cfg.indexing_settings ?? null,
		ingestSettings: cfg.ingest_settings ?? null,
		retention: cfg.retention ?? null,
		rawFieldMappings: doc.field_mappings ?? null
	};
}

export async function syncIndexesFromQuickwit() {
	const client = getQuickwitClient();

	// Fetch all data from Quickwit first (async)
	const allIndexes = await client.listIndexes();
	const syncedIndexIds = allIndexes.map((m) => m.index_config.index_id);

	// All DB operations are synchronous (SQLite driver is synchronous)
	db.transaction((tx) => {
		for (const meta of allIndexes) {
			const cfg = meta.index_config as Record<string, unknown>;
			const doc = cfg.doc_mapping as Record<string, unknown>;
			const values = buildIndexValues(meta as Record<string, unknown>, cfg, doc);

			const indexId = cfg.index_id as string;
			const otelDefaults = indexId.startsWith('otel-logs-')
				? {
						levelField: 'severity_text',
						messageField: 'body',
						tracebackField: 'attributes.exception.stacktrace'
					}
				: {};

			tx.insert(qwIndex)
				.values({ indexId, ...values, ...otelDefaults })
				.onConflictDoUpdate({
					target: qwIndex.indexId,
					set: { ...values, updatedAt: new Date() }
				})
				.run();

			const [row] = tx
				.select({ id: qwIndex.id })
				.from(qwIndex)
				.where(eq(qwIndex.indexId, indexId))
				.all();

			if (!row) throw new Error(`Failed to resolve id for index: ${indexId}`);
			const parentId = row.id;

			// Upsert field mappings
			const flatFields = flattenFieldMappings(
				(doc.field_mappings as FieldMapping[] | undefined) ?? []
			);
			for (const f of flatFields) {
				tx.insert(qwFieldMapping)
					.values({
						indexId: parentId,
						name: f.name,
						type: f.type,
						fast: f.fast ?? null,
						indexed: f.indexed ?? null,
						stored: f.stored ?? null,
						record: f.record ?? null,
						tokenizer: f.tokenizer ?? null
					})
					.onConflictDoUpdate({
						target: [qwFieldMapping.indexId, qwFieldMapping.name],
						set: {
							type: f.type,
							fast: f.fast ?? null,
							indexed: f.indexed ?? null,
							stored: f.stored ?? null,
							record: f.record ?? null,
							tokenizer: f.tokenizer ?? null
						}
					})
					.run();
			}
			// Delete stale fields
			const fieldNames = flatFields.map((f) => f.name);
			if (fieldNames.length > 0) {
				tx.delete(qwFieldMapping)
					.where(
						and(eq(qwFieldMapping.indexId, parentId), notInArray(qwFieldMapping.name, fieldNames))
					)
					.run();
			} else {
				tx.delete(qwFieldMapping).where(eq(qwFieldMapping.indexId, parentId)).run();
			}

			// Upsert sources
			const sources = ((meta as Record<string, unknown>).sources ?? []) as Record<
				string,
				unknown
			>[];
			for (const s of sources) {
				tx.insert(qwSource)
					.values({
						indexId: parentId,
						sourceId: s.source_id,
						sourceType: s.source_type,
						enabled: s.enabled ?? true,
						inputFormat: s.input_format ?? null,
						numPipelines: s.num_pipelines ?? null,
						desiredNumPipelines: s.desired_num_pipelines ?? null,
						maxNumPipelinesPerIndexer: s.max_num_pipelines_per_indexer ?? null,
						version: s.version ?? null,
						params: s.params ?? null,
						transform: s.transform ?? null
					})
					.onConflictDoUpdate({
						target: [qwSource.indexId, qwSource.sourceId],
						set: {
							sourceType: s.source_type,
							enabled: s.enabled ?? true,
							inputFormat: s.input_format ?? null,
							numPipelines: s.num_pipelines ?? null,
							desiredNumPipelines: s.desired_num_pipelines ?? null,
							maxNumPipelinesPerIndexer: s.max_num_pipelines_per_indexer ?? null,
							version: s.version ?? null,
							params: s.params ?? null,
							transform: s.transform ?? null
						}
					})
					.run();
			}
			// Delete stale sources
			const sourceIds = sources.map((s) => s.source_id);
			if (sourceIds.length > 0) {
				tx.delete(qwSource)
					.where(and(eq(qwSource.indexId, parentId), notInArray(qwSource.sourceId, sourceIds)))
					.run();
			} else {
				tx.delete(qwSource).where(eq(qwSource.indexId, parentId)).run();
			}
		}

		// Remove indexes no longer in Quickwit (cascades to field mappings and sources)
		if (syncedIndexIds.length > 0) {
			tx.delete(qwIndex).where(notInArray(qwIndex.indexId, syncedIndexIds)).run();
		} else {
			tx.delete(qwIndex).run();
		}
	});

	return getIndexSummaries();
}

export function getIndexes(userRole: string | null | undefined) {
	const visibilityFilter =
		userRole === 'admin' ? not(eq(qwIndex.visibility, 'hidden')) : eq(qwIndex.visibility, 'all');

	const rows = db
		.select({
			indexId: qwIndex.indexId,
			indexUri: qwIndex.indexUri,
			displayName: qwIndex.displayName,
			visibility: qwIndex.visibility
		})
		.from(qwIndex)
		.where(visibilityFilter)
		.all();

	return rows.map((r) => ({
		indexId: r.indexId,
		indexUri: r.indexUri ?? '',
		displayName: r.displayName,
		visibility: r.visibility as IndexVisibility
	}));
}

export function getIndexFields(indexId: string) {
	const [idx] = db
		.select({
			id: qwIndex.id,
			indexingSettings: qwIndex.indexingSettings
		})
		.from(qwIndex)
		.where(eq(qwIndex.indexId, indexId))
		.all();

	if (!idx) return { fields: [] };

	const fields = db
		.select({
			name: qwFieldMapping.name,
			type: qwFieldMapping.type,
			fast: qwFieldMapping.fast
		})
		.from(qwFieldMapping)
		.where(eq(qwFieldMapping.indexId, idx.id))
		.all();

	return {
		fields: fields.map((f) => ({
			name: f.name,
			type: f.type,
			fast: f.type === 'json' ? f.fast !== false : f.fast === true
		}))
	};
}

export function getIndexConfig(indexId: string) {
	const { id: _id, ...config } = getFieldConfig(indexId);
	return config;
}

export async function saveIndexConfig(indexId: string, fields: SaveIndexConfigFields) {
	await db
		.update(qwIndex)
		.set({ ...fields, updatedAt: new Date() })
		.where(eq(qwIndex.indexId, indexId));
}

function getIndexDetail(indexId: string) {
	const [idx] = db
		.select({
			id: qwIndex.id,
			indexId: qwIndex.indexId,
			indexUid: qwIndex.indexUid,
			indexUri: qwIndex.indexUri,
			version: qwIndex.version,
			createTimestamp: qwIndex.createTimestamp,
			timestampField: qwIndex.timestampField,
			mode: qwIndex.mode,
			indexFieldPresence: qwIndex.indexFieldPresence,
			storeSource: qwIndex.storeSource,
			storeDocumentSize: qwIndex.storeDocumentSize,
			tagFields: qwIndex.tagFields,
			defaultSearchFields: qwIndex.defaultSearchFields,
			retention: qwIndex.retention,
			levelField: qwIndex.levelField,
			messageField: qwIndex.messageField,
			tracebackField: qwIndex.tracebackField,
			displayName: qwIndex.displayName,
			visibility: qwIndex.visibility,
			contextFields: qwIndex.contextFields,
			stickyFilterFields: qwIndex.stickyFilterFields
		})
		.from(qwIndex)
		.where(eq(qwIndex.indexId, indexId))
		.all();

	if (!idx) return null;

	const fields = db
		.select({
			name: qwFieldMapping.name,
			type: qwFieldMapping.type,
			fast: qwFieldMapping.fast,
			indexed: qwFieldMapping.indexed,
			stored: qwFieldMapping.stored,
			record: qwFieldMapping.record,
			tokenizer: qwFieldMapping.tokenizer,
			description: qwFieldMapping.description
		})
		.from(qwFieldMapping)
		.where(eq(qwFieldMapping.indexId, idx.id))
		.all();

	const sources = db
		.select({
			sourceId: qwSource.sourceId,
			sourceType: qwSource.sourceType,
			enabled: qwSource.enabled,
			inputFormat: qwSource.inputFormat,
			numPipelines: qwSource.numPipelines,
			desiredNumPipelines: qwSource.desiredNumPipelines,
			maxNumPipelinesPerIndexer: qwSource.maxNumPipelinesPerIndexer,
			params: qwSource.params
		})
		.from(qwSource)
		.where(eq(qwSource.indexId, idx.id))
		.all();

	const { id: _id, ...detail } = idx;
	return { ...detail, fields, sources };
}

export function getAllIndexDetails() {
	const indexes = db.select({ indexId: qwIndex.indexId }).from(qwIndex).all();

	return indexes.map((r) => getIndexDetail(r.indexId)).filter((d) => d !== null);
}

export function assertIndexAccess(indexId: string, userRole: string | null | undefined) {
	const [idx] = db
		.select({ visibility: qwIndex.visibility })
		.from(qwIndex)
		.where(eq(qwIndex.indexId, indexId))
		.all();

	if (!idx) error(403, 'Index not accessible');

	if (idx.visibility === 'hidden') {
		error(403, 'Index not accessible');
	}
	if (idx.visibility === 'admin' && userRole !== 'admin') {
		error(403, 'Index not accessible');
	}
}
