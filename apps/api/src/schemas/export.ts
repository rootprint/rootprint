import * as v from 'valibot';

import { toNum } from '../utils/valibot.js';

export const ExportFormatSchema = v.picklist(['json', 'csv', 'text']);

const ExportTimestamp = v.pipe(toNum, v.minValue(0));

export const ExportLogsQuery = v.pipe(
	v.object({
		q: v.optional(v.string()),
		startTs: ExportTimestamp,
		endTs: ExportTimestamp,
		format: ExportFormatSchema,
		dryRun: v.optional(
			v.pipe(
				v.string(),
				v.transform((s) => s === 'true')
			)
		)
	}),
	v.check(({ startTs, endTs }) => startTs <= endTs, 'startTs must be <= endTs')
);

export type ExportLogsQueryInput = v.InferOutput<typeof ExportLogsQuery>;
