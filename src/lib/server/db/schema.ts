import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { user } from './auth.schema';

// Quickwit index metadata — one row per index
export const qwIndex = sqliteTable('qw_index', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	indexId: text('index_id').notNull().unique(),
	indexUid: text('index_uid'),
	indexUri: text('index_uri'),
	version: text('version'),
	createTimestamp: integer('create_timestamp'),
	// doc_mapping relational fields
	timestampField: text('timestamp_field'),
	partitionKey: text('partition_key'),
	maxNumPartitions: integer('max_num_partitions').default(0),
	mode: text('mode'),
	indexFieldPresence: integer('index_field_presence', { mode: 'boolean' }),
	storeSource: integer('store_source', { mode: 'boolean' }),
	storeDocumentSize: integer('store_document_size', { mode: 'boolean' }),
	docMappingUid: text('doc_mapping_uid'),
	tagFields: text('tag_fields', { mode: 'json' }).$type<string[]>(),
	defaultSearchFields: text('default_search_fields', { mode: 'json' }).$type<string[]>(),
	// JSON blob columns
	dynamicMapping: text('dynamic_mapping', { mode: 'json' }),
	tokenizers: text('tokenizers', { mode: 'json' }),
	indexingSettings: text('indexing_settings', { mode: 'json' }),
	ingestSettings: text('ingest_settings', { mode: 'json' }),
	retention: text('retention', { mode: 'json' }),
	rawFieldMappings: text('raw_field_mappings', { mode: 'json' }),
	// App-level (Logwiz-specific)
	levelField: text('level_field').notNull().default('level'),
	messageField: text('message_field').notNull().default('message'),
	tracebackField: text('traceback_field'),
	displayName: text('display_name'),
	visibility: text('visibility').notNull().default('all'),
	contextFields: text('context_fields', { mode: 'json' }).$type<string[] | null>(),
	stickyFilterFields: text('sticky_filter_fields', { mode: 'json' }).$type<string[] | null>(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
		.$onUpdate(() => new Date())
});

// Flattened field mappings — one row per field per index
export const qwFieldMapping = sqliteTable(
	'qw_field_mapping',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		indexId: integer('index_id')
			.notNull()
			.references(() => qwIndex.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: text('type').notNull(),
		fast: integer('fast', { mode: 'boolean' }),
		indexed: integer('indexed', { mode: 'boolean' }),
		stored: integer('stored', { mode: 'boolean' }),
		record: text('record'),
		tokenizer: text('tokenizer'),
		description: text('description'),
		expandDots: integer('expand_dots', { mode: 'boolean' }),
		properties: text('properties', { mode: 'json' })
	},
	(table) => [
		uniqueIndex('qw_field_mapping_index_name').on(table.indexId, table.name),
		index('qw_field_mapping_index_fast').on(table.indexId, table.fast)
	]
);

// Data sources — one row per source per index
export const qwSource = sqliteTable(
	'qw_source',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		indexId: integer('index_id')
			.notNull()
			.references(() => qwIndex.id, { onDelete: 'cascade' }),
		sourceId: text('source_id').notNull(),
		sourceType: text('source_type').notNull(),
		enabled: integer('enabled', { mode: 'boolean' }).default(true),
		inputFormat: text('input_format'),
		numPipelines: integer('num_pipelines'),
		desiredNumPipelines: integer('desired_num_pipelines'),
		maxNumPipelinesPerIndexer: integer('max_num_pipelines_per_indexer'),
		version: text('version'),
		params: text('params', { mode: 'json' }),
		transform: text('transform', { mode: 'json' })
	},
	(table) => [uniqueIndex('qw_source_index_source').on(table.indexId, table.sourceId)]
);

export const userPreference = sqliteTable(
	'user_preference',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexName: text('index_name').notNull(),
		displayFields: text('display_fields', { mode: 'json' }).$type<string[]>(),
		quickFilterFields: text('quick_filter_fields', { mode: 'json' }).$type<string[]>(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [uniqueIndex('user_preference_unique').on(table.userId, table.indexName)]
);

export const inviteToken = sqliteTable(
	'invite_token',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull()
	},
	(table) => [
		index('invite_token_user').on(table.userId),
		index('invite_token_expires').on(table.expiresAt)
	]
);

export const ingestToken = sqliteTable(
	'ingest_token',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull().unique(),
		tokenHash: text('token_hash').notNull().unique(),
		tokenPrefix: text('token_prefix').notNull(),
		indexAllowlist: text('index_allowlist', { mode: 'json' }).$type<string[] | null>(),
		revokedAt: integer('revoked_at', { mode: 'timestamp' }),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull()
	},
	(table) => [index('ingest_token_created_by').on(table.createdByUserId)]
);

export const searchHistory = sqliteTable(
	'search_history',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexName: text('index_name').notNull(),
		query: text('query').notNull().default(''),
		timeRange: text('time_range', { mode: 'json' })
			.$type<{ type: string; start?: number; end?: number; preset?: string }>()
			.notNull(),
		executedAt: integer('executed_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull()
	},
	(table) => [
		index('search_history_user_executed').on(table.userId, table.executedAt),
		index('search_history_user_index_executed').on(table.userId, table.indexName, table.executedAt)
	]
);

export const savedQuery = sqliteTable(
	'saved_query',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexName: text('index_name').notNull(),
		name: text('name').notNull(),
		description: text('description'),
		query: text('query').notNull().default(''),
		isShared: integer('is_shared', { mode: 'boolean' }).default(false).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull()
	},
	(table) => [index('saved_query_user_index').on(table.userId, table.indexName)]
);

export const sharedLink = sqliteTable('shared_link', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	code: text('code').notNull().unique(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	indexName: text('index_name').notNull(),
	query: text('query').notNull().default(''),
	startTime: integer('start_time').notNull(),
	endTime: integer('end_time').notNull(),
	logTimestamp: integer('log_timestamp').notNull(),
	logFingerprint: text('log_fingerprint').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
});

export const appSettings = sqliteTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
		.$onUpdate(() => new Date())
});

export * from './auth.schema';
