import * as v from 'valibot';

import { positiveInt } from './valibot.js';

export const IndexIdParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1))
});

export const UserIdParams = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

// Ingest keys live in `api_key` (serial id); personal keys in Better Auth's `apikey` (text id).
export const ApiKeyIdParams = v.object({
	apiKeyId: positiveInt('apiKeyId')
});

export const PersonalApiKeyIdParams = v.object({
	apiKeyId: v.pipe(v.string(), v.minLength(1))
});
