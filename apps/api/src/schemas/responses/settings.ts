import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

// Redacted Google auth status: whether credentials are configured (no secret).
export const GoogleAuthSettingsResponse = named(
	'GoogleAuthSettingsResponse',
	v.object({
		configured: v.boolean(),
		allowedDomains: v.array(v.string())
	})
);

// Redacted GitHub auth status: whether credentials are configured (no secret).
export const GitHubAuthSettingsResponse = named(
	'GitHubAuthSettingsResponse',
	v.object({
		configured: v.boolean(),
		allowedOrgs: v.array(v.string())
	})
);
