import * as v from 'valibot';

import { FilterSchema, SortDirectionSchema } from './filters.js';
import { IndexIdParams } from '../utils/params.js';
import { positiveInt } from '../utils/valibot.js';

export const createViewSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	description: v.optional(v.string()),
	query: v.string(),
	filters: v.optional(v.array(FilterSchema)),
	sortDirection: v.optional(SortDirectionSchema),
	columns: v.optional(v.nullable(v.array(v.string())))
});

export const patchViewSchema = v.pipe(
	v.object({
		name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
		description: v.optional(v.nullable(v.string())),
		query: v.optional(v.string()),
		filters: v.optional(v.array(FilterSchema)),
		sortDirection: v.optional(SortDirectionSchema),
		columns: v.optional(v.nullable(v.array(v.string())))
	}),
	v.check((b) => Object.keys(b).length > 0, 'at least one field is required')
);

export const viewItemParamsSchema = v.object({
	...IndexIdParams.entries,
	viewId: positiveInt('viewId')
});
