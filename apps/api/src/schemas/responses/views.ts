import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';
import { isoTimestampString } from '../../utils/valibot.js';
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
		createdAt: isoTimestampString,
		updatedAt: isoTimestampString
	})
);

export const SavedViewListResponse = v.array(SavedViewResponse);
