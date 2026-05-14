import * as v from 'valibot';

export const createSharedLinkSchema = v.object({
	indexName: v.pipe(v.string(), v.minLength(1)),
	query: v.string(),
	startTime: v.number(),
	endTime: v.number(),
	hit: v.record(v.string(), v.unknown())
});

export const resolveSharedHitSchema = v.object({
	code: v.pipe(v.string(), v.minLength(1))
});
