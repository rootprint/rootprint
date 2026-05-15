import { randomBytes } from 'node:crypto';

import { INGEST_TOKEN_PREFIX, INGEST_TOKEN_RANDOM_BYTES } from '../constants/ingest.js';

export function generateIngestToken(): string {
	return `${INGEST_TOKEN_PREFIX}${randomBytes(INGEST_TOKEN_RANDOM_BYTES).toString('hex')}`;
}
