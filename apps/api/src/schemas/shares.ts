import * as v from 'valibot';

import { FilterSchema } from './filters.js';

export const shareCreateSchema = v.pipe(
	v.object({
		indexId: v.pipe(v.string(), v.minLength(1)),
		query: v.string(),
		startTime: v.pipe(v.number(), v.integer(), v.minValue(0)),
		endTime: v.pipe(v.number(), v.integer(), v.minValue(0)),
		hit: v.record(v.string(), v.unknown()),
		filters: v.optional(v.array(FilterSchema), [])
	}),
	v.check((b) => b.endTime >= b.startTime, 'endTime must be >= startTime')
);
export type ShareCreateInput = v.InferOutput<typeof shareCreateSchema>;

export const shareCodeParamsSchema = v.object({
	code: v.pipe(v.string(), v.length(10))
});
