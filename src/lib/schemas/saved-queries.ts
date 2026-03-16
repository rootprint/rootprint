import * as v from 'valibot';

const indexNameField = v.pipe(v.string(), v.minLength(1));

export const getSavedQueriesSchema = v.object({
	indexName: indexNameField
});

export const saveQuerySchema = v.object({
	indexName: indexNameField,
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	description: v.optional(v.string()),
	query: v.string(),
	filters: v.record(v.string(), v.array(v.string()))
});

export const deleteSavedQuerySchema = v.object({
	id: v.number()
});
