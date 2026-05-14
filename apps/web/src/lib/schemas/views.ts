import * as v from 'valibot';

const indexIdField = v.pipe(v.string(), v.minLength(1));

export const saveViewSchema = v.object({
	indexId: indexIdField,
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	query: v.pipe(v.string(), v.maxLength(2000)),
	columns: v.array(v.string())
});

export const deleteViewSchema = v.object({
	id: v.number()
});
