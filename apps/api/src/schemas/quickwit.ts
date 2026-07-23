import * as v from 'valibot';

export const quickwitVersionResponseSchema = v.object({
	build: v.object({
		version: v.optional(v.string()),
		commit_short_hash: v.optional(v.string()),
		commit_hash: v.optional(v.string()),
		build_date: v.optional(v.string())
	})
});
