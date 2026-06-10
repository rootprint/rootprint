import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';
import { FilterSchema, SortDirectionSchema } from '../filters.js';

export const SavedViewResponse = named(
	'SavedViewResponse',
	v.object({
		id: v.number(),
		indexId: v.string(),
		name: v.string(),
		description: v.nullable(v.string()),
		query: v.string(),
		filters: v.array(FilterSchema),
		sortDirection: SortDirectionSchema,
		columns: v.nullable(v.array(v.string())),
		createdAt: v.pipe(v.string(), v.isoTimestamp()),
		updatedAt: v.pipe(v.string(), v.isoTimestamp())
	})
);

export const SavedViewListResponse = v.array(SavedViewResponse);
