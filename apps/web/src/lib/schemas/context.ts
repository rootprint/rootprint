import * as v from 'valibot';

export const getLogContextSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	log: v.record(v.string(), v.unknown()),
	excludedFields: v.array(v.string())
});

export const getMoreContextSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	log: v.record(v.string(), v.unknown()),
	excludedFields: v.array(v.string()),
	direction: v.picklist(['before', 'after']),
	anchorTs: v.pipe(v.number(), v.integer(), v.minValue(0)),
	offset: v.pipe(v.number(), v.integer(), v.minValue(0)),
	limit: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(200))
});
