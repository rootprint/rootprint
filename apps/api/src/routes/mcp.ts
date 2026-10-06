import {
	readRequestBody,
	WebStandardStreamableHTTPServerTransport
} from '@modelcontextprotocol/server';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { LOGS_READ, requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { buildMcpServer } from '../services/mcp.service.js';
import { extractBearerToken } from '../utils/bearer.js';
import { unauthorized } from '../utils/http-error.js';

const rpcError = (code: number, message: string) => ({
	jsonrpc: '2.0',
	error: { code, message },
	id: null
});

export const mcpRouter = new Hono<AuthedEnv>()
	// requireUserOrPersonalKey falls back to the session cookie; an agent endpoint has no use for
	// it, and refusing it keeps browser-driven requests (CSRF, DNS rebinding) out entirely.
	.use('*', async (c, next) => {
		if (!extractBearerToken(c.req.header('authorization'))) {
			throw unauthorized('A bearer API key is required', 'BEARER_REQUIRED');
		}
		await next();
	})
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
	.all('/', async (c) => {
		if (c.req.method !== 'POST') {
			c.header('Allow', 'POST');
			return c.json(rpcError(-32000, 'Method not allowed.'), 405);
		}
		const peek = await readRequestBody(c.req.raw.clone());
		if (!peek.tooLarge && /^\s*\[/.test(peek.text)) {
			return c.json(rpcError(-32600, 'Invalid Request: send one JSON-RPC message per POST'), 400);
		}
		const server = buildMcpServer({
			userId: c.get('session').user.id,
			apiKeyId: c.get('apiKeyActor')?.keyId,
			requestId: c.get('requestId')
		});
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			// JSON instead of SSE, so compress() and proxies have no stream to buffer.
			enableJsonResponse: true
		});
		await server.connect(transport);
		return transport.handleRequest(c.req.raw);
	});
