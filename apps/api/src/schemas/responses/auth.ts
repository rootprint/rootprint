import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

export const SetupAdminResponse = named(
	'SetupAdminResponse',
	v.object({ id: v.string(), email: v.string(), name: v.string() })
);

export const VerifyInviteResponse = named(
	'VerifyInviteResponse',
	v.object({ valid: v.literal(true), email: v.string() })
);

export const SetupPasswordResponse = named(
	'SetupPasswordResponse',
	v.object({ success: v.literal(true) })
);

export const BootstrapResponse = named(
	'BootstrapResponse',
	v.object({ needsSetupAdmin: v.boolean() })
);

export const AuthProvidersResponse = named(
	'AuthProvidersResponse',
	v.object({
		google: v.object({ enabled: v.boolean() }),
		github: v.object({ enabled: v.boolean() })
	})
);
