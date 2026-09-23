import * as v from 'valibot';

import { boolParam, tsParam } from '../utils/valibot.js';

export const ExportFormatSchema = v.picklist(['json', 'csv', 'text']);

export const ExportLogsQuery = v.pipe(
	v.object({
		q: v.optional(v.string()),
		startTs: tsParam,
		endTs: tsParam,
		format: ExportFormatSchema,
		dryRun: v.optional(boolParam)
	}),
	v.check(({ startTs, endTs }) => startTs <= endTs, 'startTs must be <= endTs')
);

export type ExportLogsQueryInput = v.InferOutput<typeof ExportLogsQuery>;
