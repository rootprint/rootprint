import { describe, expect, it } from 'vitest';

import {
	generateIngestTokenCredentials,
	hashIngestToken,
	isIngestScopeAllowed
} from '../../src/lib/server/utils/ingest-token';

describe('ingest token utilities', () => {
	it('generates token credentials with stable hash and prefix', () => {
		const credentials = generateIngestTokenCredentials();

		expect(credentials.token.startsWith('lwit_')).toBe(true);
		expect(credentials.tokenHash).toHaveLength(64);
		expect(credentials.tokenPrefix).toBe(credentials.token.slice(0, 12));
		expect(credentials.tokenHash).toBe(hashIngestToken(credentials.token));
	});

	it('allows all indexes when scope is null', () => {
		expect(isIngestScopeAllowed(null, 'otel-logs-v0_9')).toBe(true);
	});

	it('allows only configured scoped indexes', () => {
		const scope = ['otel-logs-v0_9', 'app-logs'];

		expect(isIngestScopeAllowed(scope, 'app-logs')).toBe(true);
		expect(isIngestScopeAllowed(scope, 'unknown')).toBe(false);
	});
});
