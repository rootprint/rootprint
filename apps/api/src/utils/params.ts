import * as v from 'valibot';

import { idParam, positiveInt } from './valibot.js';

export const IndexIdParams = v.object({
	indexId: idParam
});

export const UserIdParams = v.object({
	userId: idParam
});

// Ingest keys live in `api_key`, whose id is serial.
export const ApiKeyIdParams = v.object({
	apiKeyId: positiveInt('apiKeyId')
});
