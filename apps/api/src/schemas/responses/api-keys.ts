import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';
import { isoTimestampString } from '../../utils/valibot.js';
import { apiKeyRoleSchema } from '../api-keys.js';

// List/detail summary shape (no plaintext token).
export const ApiKeyResponse = named(
	'ApiKeyResponse',
	v.object({
		id: v.number(),
		name: v.string(),
		tokenPrefix: v.string(),
		role: apiKeyRoleSchema,
		indexId: v.string(),
		lastUsedAt: v.nullable(isoTimestampString),
		createdAt: isoTimestampString,
		createdByUserId: v.string()
	})
);

export const ApiKeyListResponse = v.array(ApiKeyResponse);

// Create response: summary + one-time plaintext token.
export const ApiKeyCreatedResponse = named(
	'ApiKeyCreatedResponse',
	v.object({ summary: ApiKeyResponse, token: v.string() })
);

export const ApiKeyValueResponse = named('ApiKeyValueResponse', v.object({ token: v.string() }));

export const PersonalApiKeyResponse = named(
	'PersonalApiKeyResponse',
	v.object({
		id: v.string(),
		name: v.nullable(v.string()),
		start: v.nullable(v.string()),
		userId: v.string(),
		userEmail: v.nullable(v.string()),
		lastRequest: v.nullable(isoTimestampString),
		createdAt: isoTimestampString
	})
);

export const PersonalApiKeyListResponse = v.array(PersonalApiKeyResponse);
