import * as v from 'valibot';

const indexIdSchema = v.pipe(v.string(), v.trim(), v.minLength(1, 'Index ID is required'));

export const createIngestTokenSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Token name is required')),
	indexId: indexIdSchema
});

export const deleteIngestTokenSchema = v.object({
	tokenId: v.pipe(v.number(), v.integer(), v.minValue(1, 'Token ID must be positive'))
});

export type CreateIngestTokenInput = v.InferInput<typeof createIngestTokenSchema>;
