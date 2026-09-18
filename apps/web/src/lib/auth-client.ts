import { apiKeyClient } from '@better-auth/api-key/client';
import { createAuthClient } from 'better-auth/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: '',
	plugins: [
		inferAdditionalFields({
			user: {
				role: {
					type: 'string',
					required: false,
					defaultValue: 'user',
					input: false
				}
			}
		}),
		apiKeyClient()
	]
});
