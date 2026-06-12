import * as v from 'valibot';

import { intParam } from '../utils/valibot.js';

const ActivityWindowValues = ['24h', '7d', '30d'] as const;
const WindowField = v.optional(v.picklist(ActivityWindowValues));

export const WindowQuery = v.object({
	window: WindowField
});

export const TopActorsQuery = v.object({
	window: WindowField,
	limit: v.optional(intParam({ min: 1, max: 50, label: 'limit' }))
});

export const RecentQuery = v.object({
	window: WindowField,
	offset: v.optional(intParam({ min: 0, label: 'offset' })),
	limit: v.optional(intParam({ min: 1, max: 500, label: 'limit' })),
	status: v.optional(v.picklist(['any', 'success', 'error']))
});

export const UserIdParam = v.object({ userId: v.pipe(v.string(), v.minLength(1)) });
export const ApiKeyIdParam = v.object({ apiKeyId: v.pipe(v.string(), v.minLength(1)) });

export type ActivityWindow = (typeof ActivityWindowValues)[number];
