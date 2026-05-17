import {
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

import type { IndexVisibility } from '../types.js';

import { user } from './auth.schema.js';

export const indexSettings = pgTable('index_settings', {
	indexId: text('index_id').primaryKey(),
	displayName: text('display_name'),
	visibility: text('visibility').$type<IndexVisibility>().notNull().default('all'),
	levelField: text('level_field').notNull().default('severity_text'),
	messageField: text('message_field').notNull().default('body.message'),
	tracebackField: text('traceback_field'),
	contextFields: jsonb('context_fields').$type<string[] | null>(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
});

export const userPreference = pgTable(
	'user_preference',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexId: text('index_id').notNull(),
		displayFields: jsonb('display_fields').$type<string[]>(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [
		uniqueIndex('user_preference_unique').on(table.userId, table.indexId),
		index('user_preference_index_id').on(table.indexId)
	]
);

export const inviteToken = pgTable(
	'invite_token',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('invite_token_user').on(table.userId),
		index('invite_token_expires').on(table.expiresAt)
	]
);

export const ingestToken = pgTable(
	'ingest_token',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull().unique(),
		token: text('token').notNull().unique(),
		indexId: text('index_id').notNull(),
		lastUsedAt: timestamp('last_used_at'),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('ingest_token_created_by').on(table.createdByUserId),
		index('ingest_token_index_id').on(table.indexId)
	]
);

export const searchHistory = pgTable(
	'search_history',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexId: text('index_id').notNull(),
		query: text('query').notNull().default(''),
		timeRange: jsonb('time_range')
			.$type<{ type: string; start?: number; end?: number; preset?: string }>()
			.notNull(),
		executedAt: timestamp('executed_at').defaultNow().notNull()
	},
	(table) => [
		index('search_history_user_executed').on(table.userId, table.executedAt),
		index('search_history_user_index_executed').on(table.userId, table.indexId, table.executedAt),
		index('search_history_index_id').on(table.indexId)
	]
);

export const savedQuery = pgTable(
	'saved_query',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexId: text('index_id').notNull(),
		name: text('name').notNull(),
		description: text('description'),
		query: text('query').notNull().default(''),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(table) => [
		uniqueIndex('saved_query_user_index_name_unique').on(table.userId, table.indexId, table.name),
		index('saved_query_index_id').on(table.indexId)
	]
);

export const view = pgTable(
	'view',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexId: text('index_id').notNull(),
		name: text('name').notNull(),
		query: text('query').notNull().default(''),
		columns: jsonb('columns').$type<string[]>().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('view_user_index').on(table.userId, table.indexId),
		index('view_index_id').on(table.indexId)
	]
);

export const share = pgTable(
	'share',
	{
		id: serial('id').primaryKey(),
		code: text('code').notNull().unique(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		indexId: text('index_id').notNull(),
		query: text('query').notNull().default(''),
		startTime: integer('start_time').notNull(),
		endTime: integer('end_time').notNull(),
		hit: jsonb('hit').$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('share_index_id').on(table.indexId)]
);

export const appSettings = pgTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
});

export const indexStatsSnapshot = pgTable(
	'index_stats_snapshot',
	{
		id: serial('id').primaryKey(),
		indexId: text('index_id').notNull(),
		capturedAt: timestamp('captured_at').notNull(),
		numDocs: integer('num_docs').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		uncompressedBytes: integer('uncompressed_bytes').notNull(),
		numSplits: integer('num_splits').notNull(),
		minTimestamp: integer('min_timestamp'),
		maxTimestamp: integer('max_timestamp')
	},
	(table) => [index('index_stats_snapshot_index_captured').on(table.indexId, table.capturedAt)]
);

export * from './auth.schema.js';
