import { createHash, randomBytes } from 'node:crypto';

const INGEST_TOKEN_PREFIX = 'lwit_';
const INGEST_TOKEN_RANDOM_BYTES = 24;
const INGEST_TOKEN_PREFIX_LENGTH = 12;

export function hashIngestToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function isIngestScopeAllowed(indexIds: string[] | null, indexId: string): boolean {
	if (!indexIds || indexIds.length === 0) return true;
	return indexIds.includes(indexId);
}

export function generateIngestTokenCredentials(): {
	token: string;
	tokenHash: string;
	tokenPrefix: string;
} {
	const token = `${INGEST_TOKEN_PREFIX}${randomBytes(INGEST_TOKEN_RANDOM_BYTES).toString('hex')}`;
	return {
		token,
		tokenHash: hashIngestToken(token),
		tokenPrefix: token.slice(0, INGEST_TOKEN_PREFIX_LENGTH)
	};
}
