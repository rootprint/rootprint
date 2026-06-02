import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

// Mirrors the SavedQuery public shape from toPublic() in saved-query.service.ts.
export const SavedQueryResponse = named(
	'SavedQueryResponse',
	v.object({
		id: v.number(),
		indexId: v.string(),
		name: v.string(),
		description: v.nullable(v.string()),
		query: v.string(),
		createdAt: v.date(),
		updatedAt: v.date()
	})
);

export const SavedQueryListResponse = v.array(SavedQueryResponse);
