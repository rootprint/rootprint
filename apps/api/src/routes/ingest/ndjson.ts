import { Hono } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_JSON } from '../../constants.js';
import type { KeyedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';
import { proxyToQuickwit } from '../../utils/quickwit-proxy.js';

export const ndjsonRouter = new Hono<KeyedEnv>().post(
	'/ndjson',
	describe({
		tag: 'Log ingest',
		summary: 'Ingest NDJSON log documents',
		description:
			'Proxies an NDJSON (or JSON array) log payload to Quickwit for the index associated with the ingest API key. ' +
			'Accepts application/x-ndjson or application/json content-type. ' +
			'The response body is passed through from Quickwit.',
		security: [{ ingestBearer: [] }],
		rawResponses: {
			'200': {
				description: 'Documents accepted for processing',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							description: 'Quickwit ingest acknowledgement',
							properties: {
								num_docs_for_processing: { type: 'integer' }
							}
						}
					}
				}
			}
		},
		errors: [400]
	}),
	requireIngestKey,
	async (c) => {
		const apiKey = c.get('apiKey');
		const upstreamUrl = `${config.quickwitUrl}/api/v1/${encodeURIComponent(apiKey.indexId)}/ingest`;
		const contentType = c.req.header('content-type') ?? CONTENT_TYPE_JSON;

		const headers: Record<string, string> = { 'content-type': contentType };
		const contentLength = c.req.header('content-length');
		if (contentLength) headers['content-length'] = contentLength;
		const contentEncoding = c.req.header('content-encoding');
		if (contentEncoding) headers['content-encoding'] = contentEncoding;

		const result = await proxyToQuickwit(c, { upstreamUrl, headers });

		const respHeaders: Record<string, string> = {};
		const upstreamCt = result.headers.get('content-type');
		if (upstreamCt) respHeaders['content-type'] = upstreamCt;
		return new Response(result.bodyBytes, { status: result.status, headers: respHeaders });
	}
);
