import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';
import { isoTimestampString } from '../../utils/valibot.js';

export const ServiceAccountResponse = named(
	'ServiceAccountResponse',
	v.object({
		id: v.string(),
		name: v.string(),
		createdAt: isoTimestampString,
		keyCount: v.number()
	})
);

export const ServiceAccountListResponse = v.array(ServiceAccountResponse);

export const ServiceAccountCreatedResponse = named(
	'ServiceAccountCreatedResponse',
	v.object({ id: v.string() })
);
