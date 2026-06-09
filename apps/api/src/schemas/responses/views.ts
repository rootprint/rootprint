import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

// Mirrors the SavedView public shape from toPublic() in view.service.ts.
export const SavedViewResponse = named(
	'SavedViewResponse',
	v.object({
		id: v.number(),
		indexId: v.string(),
		name: v.string(),
		description: v.nullable(v.string()),
		query: v.string(),
		filters: v.array(
			v.object({
				field: v.string(),
				value: v.string(),
				exclude: v.boolean()
			})
		),
		sortDirection: v.picklist(['asc', 'desc']),
		columns: v.nullable(v.array(v.string())),
		createdAt: v.date(),
		updatedAt: v.date()
	})
);

export const SavedViewListResponse = v.array(SavedViewResponse);
