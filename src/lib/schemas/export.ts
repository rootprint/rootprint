import * as v from 'valibot';

export const exportLogsSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	query: v.string(),
	startTimestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
	endTimestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
	format: v.picklist(['ndjson', 'csv', 'text'])
});

export type ExportLogsInput = v.InferOutput<typeof exportLogsSchema>;
