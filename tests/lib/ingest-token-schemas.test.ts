import { safeParse } from 'valibot';
import { describe, expect, it } from 'vitest';

import {
	createIngestTokenSchema,
	deleteIngestTokenSchema
} from '../../src/lib/schemas/ingest-tokens';

describe('ingest token schemas', () => {
	it('accepts minimal create payload', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: 'CI token'
		});

		expect(result.success).toBe(true);
	});

	it('accepts scoped create payload', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: 'Prod router',
			indexIds: ['otel-logs-v0_9', 'app-logs']
		});

		expect(result.success).toBe(true);
	});

	it('rejects create payload with blank name', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: '  '
		});

		expect(result.success).toBe(false);
	});

	it('rejects create payload with invalid index ids', () => {
		const result = safeParse(createIngestTokenSchema, {
			name: 'Scoped',
			indexIds: ['ok-index', '  ']
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
