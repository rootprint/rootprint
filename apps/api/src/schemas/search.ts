import * as v from 'valibot';

import { toNum } from '../utils/valibot.js';

export const SearchQuery = v.object({
	q: v.optional(v.string()),
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('must be 1–1000');
				return n;
			})
		)
	),
	offset: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 0) throw new Error('must be >= 0');
				return n;
			})
		)
	),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	sortOrder: v.optional(v.picklist(['asc', 'desc'])),
	countAll: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true')
		)
	)
});

export type SearchQueryInput = v.InferOutput<typeof SearchQuery>;
