import * as v from 'valibot';

export const searchLogsSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	query: v.string(),
	timeRange: v.optional(v.picklist(['5m', '15m', '30m', '1h', '3h', '6h', '1d', '3d', '1w', '1M'])),
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)),
	startTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	endTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	quickFilterFields: v.optional(v.array(v.string()))
});

export type SearchLogsInput = v.InferOutput<typeof searchLogsSchema>;

export const searchFieldValuesSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	field: v.pipe(v.string(), v.minLength(1)),
	searchTerm: v.string(),
	query: v.optional(v.string()),
	timeRange: v.optional(v.picklist(['5m', '15m', '30m', '1h', '3h', '6h', '1d', '3d', '1w', '1M'])),
	startTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	endTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
});

export type SearchFieldValuesInput = v.InferOutput<typeof searchFieldValuesSchema>;

export const searchLogHistogramSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	query: v.string(),
	timeRange: v.optional(v.picklist(['5m', '15m', '30m', '1h', '3h', '6h', '1d', '3d', '1w', '1M'])),
	startTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
	endTimestamp: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)))
});

export type SearchLogHistogramInput = v.InferOutput<typeof searchLogHistogramSchema>;

export const pollLiveLogsSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	query: v.string(),
	startTimestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
	endTimestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200))
});

export type PollLiveLogsInput = v.InferOutput<typeof pollLiveLogsSchema>;

