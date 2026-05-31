import * as v from 'valibot';

import { INDEX_VISIBILITIES } from '../constants/index-visibility.js';

export const saveIndexConfigSchema = v.object({
	displayName: v.optional(v.nullable(v.pipe(v.string(), v.maxLength(128)))),
	visibility: v.optional(v.picklist(INDEX_VISIBILITIES)),
	levelField: v.optional(v.pipe(v.string(), v.minLength(1))),
	messageField: v.optional(v.pipe(v.string(), v.minLength(1))),
	tracebackField: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1)))),
	contextFields: v.optional(v.nullable(v.array(v.string())))
});

export type SaveIndexConfigInput = v.InferOutput<typeof saveIndexConfigSchema>;
