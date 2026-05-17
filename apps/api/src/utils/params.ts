import * as v from 'valibot';

export const IndexIdParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1))
});

export const UserIdParams = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

export const IdParams = v.object({
	id: v.pipe(
		v.string(),
		v.regex(/^[1-9]\d*$/, 'id must be a positive integer'),
		v.transform(Number)
	)
});
