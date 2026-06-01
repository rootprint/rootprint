import { sql } from 'drizzle-orm';
import {
	bigint,
	bigserial,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

import type { DisplayMode, IndexVisibility } from '../types.js';

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
		lineWrap: boolean('line_wrap').notNull().default(false),
		displayMode: text('display_mode').$type<DisplayMode>().notNull().default('table'),
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

export const apiKey = pgTable(
	'api_key',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull().unique(),
		token: text('token').notNull().unique(),
		role: text('role').$type<'ingest' | 'search'>().notNull(),
		indexId: text('index_id').notNull(),
		lastUsedAt: timestamp('last_used_at'),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('api_key_created_by').on(table.createdByUserId),
		index('api_key_index_id').on(table.indexId),
		index('api_key_role').on(table.role),
		check('api_key_role_check', sql`${table.role} in ('ingest','search')`)
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
		numDocs: bigint('num_docs', { mode: 'number' }).notNull(),
		sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
		uncompressedBytes: bigint('uncompressed_bytes', { mode: 'number' }).notNull(),
		numSplits: integer('num_splits').notNull(),
		minTimestamp: bigint('min_timestamp', { mode: 'number' }),
		maxTimestamp: bigint('max_timestamp', { mode: 'number' })
	},
	(table) => [index('index_stats_snapshot_index_captured').on(table.indexId, table.capturedAt)]
);

export const searchAudit = pgTable(
	'search_audit',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
		source: text('source').$type<'ui' | 'token'>().notNull(),
		userId: text('user_id'),
		apiKeyId: integer('api_key_id'),
		indexId: text('index_id').notNull(),
		query: text('query').notNull().default(''),
		startTs: bigint('start_ts', { mode: 'number' }),
		endTs: bigint('end_ts', { mode: 'number' }),
		status: text('status').$type<'success' | 'error'>().notNull(),
		durationMs: integer('duration_ms').notNull(),
		numHits: bigint('num_hits', { mode: 'number' }),
		errorCode: text('error_code'),
		errorMessage: text('error_message')
	},
	(table) => [
		index('search_audit_executed_at').on(table.executedAt),
		index('search_audit_user_executed')
			.on(table.userId, table.executedAt)
			.where(sql`${table.userId} IS NOT NULL`),
		index('search_audit_api_key_executed')
			.on(table.apiKeyId, table.executedAt)
			.where(sql`${table.apiKeyId} IS NOT NULL`),
		index('search_audit_index_executed').on(table.indexId, table.executedAt),
		check(
			'search_audit_actor_check',
			sql`(${table.source} = 'ui'    AND ${table.userId} IS NOT NULL AND ${table.apiKeyId} IS NULL)
			 OR (${table.source} = 'token' AND ${table.apiKeyId} IS NOT NULL AND ${table.userId} IS NULL)`
		)
	]
);

export * from './auth.schema.js';
