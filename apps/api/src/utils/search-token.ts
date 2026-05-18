import { randomBytes } from 'node:crypto';

import { SEARCH_TOKEN_PREFIX, SEARCH_TOKEN_RANDOM_BYTES } from '../constants/tokens.js';

export function generateSearchToken(): string {
	return `${SEARCH_TOKEN_PREFIX}${randomBytes(SEARCH_TOKEN_RANDOM_BYTES).toString('hex')}`;
}
