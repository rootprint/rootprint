import * as v from 'valibot';

export const IndexIdParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1))
});

export const UserIdParams = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

/** A string path/query param constrained to a positive integer, transformed to a number. */
export const positiveInt = (label = 'value') =>
	v.pipe(
		v.string(),
		v.regex(/^[1-9]\d*$/, `${label} must be a positive integer`),
		v.transform(Number)
	);

export const ApiKeyIdParams = v.object({
	apiKeyId: positiveInt('apiKeyId')
});
