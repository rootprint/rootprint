import * as v from 'valibot';

export const searchLogStatsSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	query: v.string(),
	field: v.pipe(v.string(), v.minLength(1)),
	timeRange: v.optional(
		v.picklist(['5m', '15m', '30m', '1h', '3h', '6h', '1d', '3d', '1w', '1M'])
	),
	startTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	endTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
});

export type SearchLogStatsInput = v.InferOutput<typeof searchLogStatsSchema>;
