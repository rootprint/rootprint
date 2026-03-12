import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

export const indexConfig = sqliteTable('index_config', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	indexName: text('index_name').notNull().unique(),
	levelField: text('level_field').notNull().default('level'),
	timestampField: text('timestamp_field').notNull().default('timestamp'),
	messageField: text('message_field').notNull().default('message'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
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
		quickFilterFields: text('quick_filter_fields', { mode: 'json' }).$type<string[]>(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.default(sql`(unixepoch())`)
			.notNull()
	},
	(table) => [uniqueIndex('user_preference_unique').on(table.userId, table.indexName)]
);

export const inviteToken = sqliteTable('invite_token', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
});

export const searchHistory = sqliteTable('search_history', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	indexName: text('index_name').notNull(),
	query: text('query').notNull().default(''),
	timeRange: text('time_range', { mode: 'json' })
		.$type<{ type: string; start?: number; end?: number; preset?: string }>()
		.notNull(),
	filters: text('filters', { mode: 'json' }).$type<Record<string, string[]>>().notNull(),
	executedAt: integer('executed_at', { mode: 'timestamp' })
		.default(sql`(unixepoch())`)
		.notNull()
});

export * from './auth.schema';
