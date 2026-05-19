import { Hono } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_JSON } from '../../constants/ingest.js';
import type { AppEnv } from '../../env.js';
import { requireToken } from '../../middleware/require-token.js';
import { proxyToQuickwit } from '../../utils/quickwit-proxy.js';

export const ndjsonRouter = new Hono<AppEnv>()
	.post('/ndjson', requireToken, async (c) => {
		const token = c.get('token')!;
		const upstreamUrl = `${config.quickwitUrl}/api/v1/${encodeURIComponent(token.indexId)}/ingest`;
		const contentType = c.req.header('content-type') ?? CONTENT_TYPE_JSON;

		const headers: Record<string, string> = { 'content-type': contentType };
		const contentLength = c.req.header('content-length');
		if (contentLength) headers['content-length'] = contentLength;

		const result = await proxyToQuickwit(c, { upstreamUrl, headers });

		const respHeaders: Record<string, string> = {};
		const upstreamCt = result.headers.get('content-type');
		if (upstreamCt) respHeaders['content-type'] = upstreamCt;
		return new Response(result.bodyBytes, { status: result.status, headers: respHeaders });
	});
