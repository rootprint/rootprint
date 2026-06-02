import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

export const HealthResponse = named('HealthResponse', v.object({ status: v.literal('ok') }));
