import * as v from 'valibot';

export const createIngestTokenSchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, 'Token name is required'),
		v.maxLength(100, 'Token name must be 100 characters or fewer')
	),
	indexId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Index ID is required'))
});

export type CreateIngestTokenInput = v.InferOutput<typeof createIngestTokenSchema>;
