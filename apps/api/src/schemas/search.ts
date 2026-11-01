import * as v from 'valibot';

import { SEARCH_MAX_LIMIT } from '../constants.js';
import { boolParam, intParam, tsEndParam, tsParam, withEndNow } from '../utils/valibot.js';
import { SortDirectionSchema } from './filters.js';

export const SearchQuery = v.pipe(
	v.object({
		q: v.optional(v.string()),
		limit: v.optional(intParam({ min: 1, max: SEARCH_MAX_LIMIT, label: 'limit' })),
		offset: v.optional(intParam({ min: 0, label: 'offset' })),
		startTs: v.optional(tsParam),
		endTs: v.optional(tsEndParam),
		sortOrder: v.optional(SortDirectionSchema),
		countAll: v.optional(boolParam)
	}),
	v.transform(withEndNow)
);

export type SearchQueryInput = v.InferOutput<typeof SearchQuery>;
