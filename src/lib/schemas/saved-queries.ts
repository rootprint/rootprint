import * as v from 'valibot';

const indexIdField = v.pipe(v.string(), v.minLength(1));

export const saveQuerySchema = v.object({
	indexId: indexIdField,
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	description: v.optional(v.string()),
	query: v.string()
});

export const deleteSavedQuerySchema = v.object({
	id: v.number()
});

export const shareQuerySchema = v.object({
	id: v.number()
});

export const unshareQuerySchema = v.object({
	id: v.number()
});
