import * as v from 'valibot';

import { positiveInt } from '../utils/params.js';

const ActivityWindowValues = ['24h', '7d', '30d'] as const;
const WindowField = v.optional(v.picklist(ActivityWindowValues));

export const WindowQuery = v.object({
	window: WindowField
});

export const SlowestQuery = v.object({
	window: WindowField,
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('must be 1–100');
				return n;
			})
		)
	)
});

export const TopActorsQuery = v.object({
	window: WindowField,
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error('must be 1–50');
				return n;
			})
		)
	)
});

export const RecentQuery = v.object({
	window: WindowField,
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
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error('must be 1–500');
				return n;
			})
		)
	),
	status: v.optional(v.picklist(['any', 'success', 'error']))
});

export const UserIdParam = v.object({ userId: v.pipe(v.string(), v.minLength(1)) });
export const ApiKeyIdParam = v.object({ apiKeyId: positiveInt('apiKeyId') });

export type ActivityWindow = (typeof ActivityWindowValues)[number];
