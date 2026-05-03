import * as v from 'valibot';

const indexIdSchema = v.pipe(v.string(), v.minLength(1));
const timeRangeSchema = v.optional(
	v.picklist(['5m', '15m', '30m', '1h', '3h', '6h', '1d', '3d', '1w', '1M'])
);
const epochSecondsSchema = v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)));

const timeWindowFields = {
	timeRange: timeRangeSchema,
	startTimestamp: epochSecondsSchema,
	endTimestamp: epochSecondsSchema
};

export const searchLogsSchema = v.object({
	indexId: indexIdSchema,
	query: v.string(),
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200)),
	sortDirection: v.optional(v.picklist(['asc', 'desc'])),
	...timeWindowFields
});

export type SearchLogsInput = v.InferOutput<typeof searchLogsSchema>;

export const searchFieldValuesSchema = v.object({
	indexId: indexIdSchema,
	field: v.pipe(v.string(), v.minLength(1)),
	searchTerm: v.string(),
	query: v.optional(v.string()),
	...timeWindowFields
});

export type SearchFieldValuesInput = v.InferOutput<typeof searchFieldValuesSchema>;

export const searchLogHistogramSchema = v.object({
	indexId: indexIdSchema,
	query: v.string(),
	...timeWindowFields
});

export type SearchLogHistogramInput = v.InferOutput<typeof searchLogHistogramSchema>;
