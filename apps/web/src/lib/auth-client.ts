import { apiKeyClient } from '@better-auth/api-key/client';
import { createAuthClient } from 'better-auth/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { USER_ADDITIONAL_FIELDS } from 'api/constants';

export const authClient = createAuthClient({
	baseURL: '',
	plugins: [inferAdditionalFields({ user: USER_ADDITIONAL_FIELDS }), apiKeyClient()]
});
