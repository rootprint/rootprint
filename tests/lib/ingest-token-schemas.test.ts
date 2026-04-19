import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import {
	createIngestTokenSchema,
	deleteIngestTokenSchema
} from '../../src/lib/schemas/ingest-tokens';

describe('ingest token schemas', () => {
	it('accepts a valid create payload', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: 'Prod router',
			indexId: 'otel-logs-v0_9'
		});

		expect(result.success).toBe(true);
	});

	it('rejects create payload with blank name', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: '  ',
			indexId: 'otel-logs-v0_9'
		});

		expect(result.success).toBe(false);
	});

	it('rejects create payload without indexId', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: 'Missing index'
		});

		expect(result.success).toBe(false);
	});

	it('rejects create payload with blank indexId', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: 'Blank index',
			indexId: '  '
		});

		expect(result.success).toBe(false);
	});

	it('accepts delete payload with positive id', () => {
		const result = safeParse(deleteIngestTokenSchema, { tokenId: 1 });

		expect(result.success).toBe(true);
	});

	it('rejects delete payload with non-positive id', () => {
		const result = safeParse(deleteIngestTokenSchema, { tokenId: 0 });

		expect(result.success).toBe(false);
	});
});
