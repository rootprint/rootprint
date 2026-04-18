import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { IndexVisibility } from '$lib/types';

import { user } from './auth.schema';

export const indexesMeta = sqliteTable('indexes_meta', {
	indexId: text('index_id').primaryKey(),
	displayName: text('display_name'),
	visibility: text('visibility').$type<IndexVisibility>().notNull().default('all'),
	levelField: text('level_field').notNull().default('level'),
	messageField: text('message_field').notNull().default('message'),
	tracebackField: text('traceback_field'),
	contextFields: text('context_fields', { mode: 'json' }).$type<string[] | null>(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
		.$onUpdate(() => new Date())
});

export const userPreference = sqliteTable(
	'user_preference',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexName: text('index_name').notNull(),
		displayFields: text('display_fields', { mode: 'json' }).$type<string[]>(),
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
