import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

const count = v.pipe(v.number(), v.integer());

// Quickwit omits the ingested/rejected counts when it has none to report.
export const NdjsonIngestResponse = named(
	'NdjsonIngestResponse',
	v.object({
		num_docs_for_processing: count,
		num_ingested_docs: v.optional(count),
		num_rejected_docs: v.optional(count)
	})
);
