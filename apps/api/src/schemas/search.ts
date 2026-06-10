import * as v from 'valibot';

import { intParam, toNum } from '../utils/valibot.js';
import { SortDirectionSchema } from './filters.js';

export const SearchQuery = v.object({
	q: v.optional(v.string()),
	limit: v.optional(intParam({ min: 1, max: 1000, label: 'limit' })),
	offset: v.optional(intParam({ min: 0, label: 'offset' })),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	sortOrder: v.optional(SortDirectionSchema),
	countAll: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true')
		)
	)
});

export type SearchQueryInput = v.InferOutput<typeof SearchQuery>;
