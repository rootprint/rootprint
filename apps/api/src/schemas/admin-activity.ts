import * as v from 'valibot';

import { intParam } from '../utils/valibot.js';

const ActivityWindowValues = ['24h', '7d', '30d'] as const;
const ScopeId = v.optional(v.pipe(v.string(), v.minLength(1)));

// Each scope param narrows the activity to one user, API key or index; several combine with AND.
export const ActivityQuery = v.object({
	window: v.optional(v.picklist(ActivityWindowValues)),
	user: ScopeId,
	apiKey: ScopeId,
	index: ScopeId
});

export const TopActorsQuery = v.object({
	...ActivityQuery.entries,
	limit: v.optional(intParam({ min: 1, max: 50, label: 'limit' }), '10')
});

export const RecentQuery = v.object({
	...ActivityQuery.entries,
	offset: v.optional(intParam({ min: 0, label: 'offset' }), '0'),
	limit: v.optional(intParam({ min: 1, max: 500, label: 'limit' }), '100'),
	status: v.optional(v.picklist(['any', 'success', 'error']), 'any')
});

export type ActivityWindow = (typeof ActivityWindowValues)[number];
export type ActivityQueryInput = v.InferInput<typeof ActivityQuery>;
export type ActivityFilter = v.InferOutput<typeof ActivityQuery>;
export type TopActorsFilter = v.InferOutput<typeof TopActorsQuery>;
export type RecentFilter = v.InferOutput<typeof RecentQuery>;
