import * as v from 'valibot';

export const indexIdSchema = v.pipe(v.string(), v.minLength(1));

export const saveIndexConfigSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	levelField: v.optional(v.pipe(v.string(), v.minLength(1)), 'level'),
	messageField: v.optional(v.pipe(v.string(), v.minLength(1)), 'message'),
	tracebackField: v.optional(v.string()),
	displayName: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.transform((s) => s || null)
		)
	),
	visibility: v.optional(v.picklist(['hidden', 'admin', 'all']), 'all')
});
