import * as v from 'valibot';

const indexIdField = v.pipe(v.string(), v.minLength(1));

export const getPreferenceSchema = v.object({
	indexId: indexIdField
});

export const saveDisplayFieldsSchema = v.object({
	indexId: indexIdField,
	fields: v.array(v.string())
});

export const getIndexFieldsSchema = v.object({
	indexId: indexIdField
});
