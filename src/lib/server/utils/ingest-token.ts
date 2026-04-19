import { randomBytes } from 'node:crypto';

const INGEST_TOKEN_PREFIX = 'lwit_';
const INGEST_TOKEN_RANDOM_BYTES = 24;

export function generateIngestToken(): string {
	return `${INGEST_TOKEN_PREFIX}${randomBytes(INGEST_TOKEN_RANDOM_BYTES).toString('hex')}`;
}
