import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { qwIndex, qwFieldMapping, qwSource } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { saveIndexConfigSchema, indexIdSchema } from '$lib/schemas/index-config';
import { getIndexFieldsSchema } from '$lib/schemas/preference';
import { requireUser, requireAdmin } from '$lib/middleware/auth';
import { syncIndexesFromQuickwit, getIndexSummaries, getFieldConfig } from '$lib/server/sync';

export const getIndexes = query(async () => {
	requireUser();
	const rows = await db
		.select({ indexId: qwIndex.indexId, indexUri: qwIndex.indexUri })
		.from(qwIndex);

	return rows.map((r) => ({
		indexId: r.indexId,
		indexUri: r.indexUri ?? ''
	}));
});

export const getIndexFields = query(getIndexFieldsSchema, async (data) => {
	requireUser();

	const [idx] = await db
		.select({
			id: qwIndex.id,
			indexingSettings: qwIndex.indexingSettings
		})
		.from(qwIndex)
		.where(eq(qwIndex.indexId, data.indexId));

	if (!idx) return { fields: [], commitTimeoutSecs: 30 };

	const fields = await db
		.select({
			name: qwFieldMapping.name,
			type: qwFieldMapping.type,
			fast: qwFieldMapping.fast
		})
		.from(qwFieldMapping)
		.where(eq(qwFieldMapping.indexId, idx.id));

	const settings = idx.indexingSettings as { commit_timeout_secs?: number } | null;
	const commitTimeoutSecs = settings?.commit_timeout_secs ?? 30;

	return {
		fields: fields.map((f) => ({ name: f.name, type: f.type, fast: f.fast === true })),
		commitTimeoutSecs
	};
});

export const getIndexConfig = query(indexIdSchema, async (indexId) => {
	requireUser();
	const { id: _, ...config } = getFieldConfig(indexId);
	return config;
});

export const saveIndexConfig = command(saveIndexConfigSchema, async (data) => {
	requireAdmin();
	const { indexId, ...fields } = data;
	await db
		.update(qwIndex)
		.set({ ...fields, updatedAt: new Date() })
		.where(eq(qwIndex.indexId, indexId));
});

export const syncIndexes = command(async () => {
	requireAdmin();
	return syncIndexesFromQuickwit();
});

export const getLocalIndexes = query(async () => {
	requireUser();
	return getIndexSummaries();
});

export const getLocalIndexDetail = query(indexIdSchema, async (indexId) => {
	requireAdmin();

	const [idx] = await db
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
			messageField: qwIndex.messageField
		})
		.from(qwIndex)
		.where(eq(qwIndex.indexId, indexId));
	if (!idx) return null;

	const fields = await db
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
		.where(eq(qwFieldMapping.indexId, idx.id));

	const sources = await db
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
		.where(eq(qwSource.indexId, idx.id));

	const { id: _, ...detail } = idx;
	return { ...detail, fields, sources };
});
