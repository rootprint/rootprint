import * as v from 'valibot';

const indexIdField = v.pipe(v.string(), v.minLength(1));

export const getHistorySchema = v.object({
	indexId: indexIdField
});

export const recordSearchSchema = v.object({
	indexId: indexIdField,
	query: v.string(),
	timeRange: v.union([
		v.object({ type: v.literal('relative'), preset: v.string() }),
		v.object({ type: v.literal('absolute'), start: v.number(), end: v.number() })
	])
});

export const deleteHistoryEntrySchema = v.object({
	id: v.number()
});

export const clearHistorySchema = v.object({
	indexId: v.optional(v.pipe(v.string(), v.minLength(1)))
});
