import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/services/ingest-token.service', () => ({
	verifyIngestToken: () => null
}));

vi.mock('$lib/server/config', () => ({
	config: {
		quickwitUrl: 'http://quickwit:7280/api/v1'
	}
}));

import { _createIngestHandler } from '../../src/routes/api/ingest/[indexId]/+server';

describe('POST /api/ingest/[indexId]', () => {
	it('returns 401 when bearer token is missing', async () => {
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest: async () => new Response('ok')
		});

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9', {
				method: 'POST',
				body: '[{"message":"hi"}]'
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(401);
	});

	it('returns 403 for invalid token', async () => {
		const POST = _createIngestHandler({
			verifyToken: () => null,
			forwardIngest: async () => new Response('ok')
		});

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9', {
				method: 'POST',
				headers: { authorization: 'Bearer test-token' },
				body: '[{"message":"hi"}]'
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(403);
	});

	it('returns 400 for empty body', async () => {
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest: async () => new Response('ok')
		});

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9', {
				method: 'POST',
				headers: { authorization: 'Bearer test-token' },
				body: ''
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(400);
	});

	it('returns 413 when request body exceeds limit', async () => {
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest: async () => new Response('ok')
		});
		const largeBody = 'a'.repeat(11 * 1024 * 1024);

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9', {
				method: 'POST',
				headers: { authorization: 'Bearer test-token' },
				body: largeBody
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(413);
	});

	it('returns 413 from content-length check before reading body', async () => {
		const forwardIngest = vi.fn(async () => new Response('ok'));
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest
		});
		const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: {
				url: 'http://localhost/api/ingest/otel-logs-v0_9',
				headers: {
					get: (header: string) => {
						if (header === 'authorization') return 'Bearer test-token';
						if (header === 'content-length') return `${11 * 1024 * 1024}`;
						return null;
					}
				},
				arrayBuffer
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(413);
		expect(arrayBuffer).not.toHaveBeenCalled();
		expect(forwardIngest).not.toHaveBeenCalled();
	});

	it('returns 502 when upstream forwarding fails', async () => {
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest: async () => {
				throw new Error('network down');
			}
		});

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9', {
				method: 'POST',
				headers: { authorization: 'Bearer test-token' },
				body: '[{"message":"hi"}]'
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(502);
	});

	it('passes upstream status and body on success', async () => {
		const forwardIngest = vi.fn(
			async (_indexId: string, _search: string, _body: ArrayBuffer, _contentType: string | null) =>
				new Response('{"ingested":1}', {
					status: 202,
					headers: { 'content-type': 'application/json' }
				})
		);
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest
		});

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9?commit=wait_for', {
				method: 'POST',
				headers: {
					authorization: 'Bearer test-token',
					'content-type': 'application/json'
				},
				body: '[{"message":"hi"}]'
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(202);
		expect(response.headers.get('content-type')).toContain('application/json');
		expect(await response.text()).toBe('{"ingested":1}');
		expect(forwardIngest).toHaveBeenCalledOnce();
		expect(forwardIngest).toHaveBeenCalledWith(
			'otel-logs-v0_9',
			'?commit=wait_for',
			expect.any(ArrayBuffer),
			'application/json'
		);
		const bodyArg = forwardIngest.mock.calls[0][2] as ArrayBuffer;
		expect(new TextDecoder().decode(bodyArg)).toBe('[{"message":"hi"}]');
	});

	it('accepts lowercase bearer authorization scheme', async () => {
		const forwardIngest = vi.fn(
			async (_indexId: string, _search: string, _body: ArrayBuffer, _contentType: string | null) =>
				new Response('{"ingested":1}', {
					status: 202,
					headers: { 'content-type': 'application/json' }
				})
		);
		const POST = _createIngestHandler({
			verifyToken: () => ({ id: 1, name: 'token' }),
			forwardIngest
		});

		const response = await POST({
			params: { indexId: 'otel-logs-v0_9' },
			request: new Request('http://localhost/api/ingest/otel-logs-v0_9', {
				method: 'POST',
				headers: {
					authorization: 'bearer test-token',
					'content-type': 'application/json'
				},
				body: '[{"message":"hi"}]'
			})
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(202);
		expect(forwardIngest).toHaveBeenCalledOnce();
	});
});
