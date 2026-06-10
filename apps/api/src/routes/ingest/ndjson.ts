import { Hono } from 'hono';

import { CONTENT_TYPE_JSON } from '../../constants.js';
import type { KeyedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwitUrl } from '../../lib/quickwit.js';
import { proxyToQuickwit } from '../../lib/quickwit-proxy.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';

export const ndjsonRouter = new Hono<KeyedEnv>().post(
	'/ndjson',
	describe({
		tag: 'Log ingest',
		summary: 'Ingest NDJSON log documents',
		description:
			'Proxies an NDJSON (or JSON array) log payload to Quickwit for the index associated with the ingest API key. ' +
			'Accepts application/x-ndjson or application/json content-type. ' +
			'Success and 4xx responses are passed through from Quickwit (400 bodies carry per-document parse errors); ' +
			'upstream 5xx responses are mapped to the standard 503 error contract.',
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
		}
	}),
	requireIngestKey,
	async (c) => {
		const apiKey = c.get('apiKey');
		const upstreamUrl = quickwitUrl(`/api/v1/${encodeURIComponent(apiKey.indexId)}/ingest`);
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
