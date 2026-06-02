import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

export const ShareCreateResponse = named('ShareCreateResponse', v.object({ code: v.string() }));

export const ShareViewResponse = named(
	'ShareViewResponse',
	v.object({
		indexId: v.string(),
		query: v.string(),
		startTime: v.number(),
		endTime: v.number(),
		hit: v.record(v.string(), v.unknown())
	})
);
