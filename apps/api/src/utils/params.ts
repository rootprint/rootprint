import * as v from 'valibot';

import { positiveInt } from './valibot.js';

export const IndexIdParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1))
});

export const UserIdParams = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

export const ApiKeyIdParams = v.object({
	apiKeyId: positiveInt('apiKeyId')
});
