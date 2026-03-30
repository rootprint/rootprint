import * as v from 'valibot';

export const indexIdSchema = v.object({
	indexId: v.pipe(v.string(), v.minLength(1))
});

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
	visibility: v.optional(v.picklist(['hidden', 'admin', 'all']), 'all'),
	contextFields: v.optional(
		v.pipe(
			v.string(),
			v.transform((s): string[] | null => {
				if (!s) return null;
				try {
					const parsed = JSON.parse(s);
					return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
				} catch {
					return null;
				}
			})
		)
	),
	stickyFilterFields: v.optional(
		v.pipe(
			v.string(),
			v.transform((s): string[] | null => {
				if (!s) return null;
				try {
					const parsed = JSON.parse(s);
					return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
				} catch {
					return null;
				}
			})
		)
	)
});
