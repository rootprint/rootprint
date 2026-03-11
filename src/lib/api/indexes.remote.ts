import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { indexConfig } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { indexNameSchema, saveIndexConfigSchema } from '$lib/schemas/index-config';
import { getIndexFieldsSchema } from '$lib/schemas/preference';
import { requireUser, requireAdmin } from '$lib/middleware/auth';
import { getQuickwitClient } from '$lib/server/quickwit';

export const getIndexes = query(async () => {
	requireUser();
	const client = getQuickwitClient();
	const indexes = await client.listIndexes();
	return indexes.map((idx) => ({
		indexId: idx.index_config.index_id,
		indexUri: idx.index_config.index_uri ?? ''
	}));
});

export const getIndexFields = command(getIndexFieldsSchema, async (data) => {
	requireUser();
	const client = getQuickwitClient();
	const metadata = await client.getIndex(data.indexName);
	const fieldMappings = metadata.index_config.doc_mapping.field_mappings;

	function flattenFields(
		mappings: typeof fieldMappings,
		prefix = ''
	): { name: string; type: string; fast: boolean }[] {
		const result: { name: string; type: string; fast: boolean }[] = [];
		for (const f of mappings) {
			const fullName = prefix ? `${prefix}.${f.name}` : f.name;
			if (f.type === 'object' && f.field_mappings) {
				result.push(...flattenFields(f.field_mappings, fullName));
			} else {
				result.push({ name: fullName, type: f.type, fast: f.fast === true });
			}
		}
		return result;
	}

	return flattenFields(fieldMappings);
});

export const getIndexConfig = command(indexNameSchema, async (indexName) => {
	requireUser();

	const [config] = await db.select().from(indexConfig).where(eq(indexConfig.indexName, indexName));

	return {
		levelField: config?.levelField ?? 'level',
		timestampField: config?.timestampField ?? 'timestamp',
		messageField: config?.messageField ?? 'message'
	};
});

export const saveIndexConfig = command(saveIndexConfigSchema, async (data) => {
	requireAdmin();

	const { indexName, ...fields } = data;

	await db
		.insert(indexConfig)
		.values({ indexName, ...fields })
		.onConflictDoUpdate({
			target: indexConfig.indexName,
			set: { ...fields, updatedAt: new Date() }
		});
});
