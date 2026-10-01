import { Hono } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_JSON } from '../../constants.js';
import type { KeyedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwitUrl } from '../../lib/quickwit/client.js';
import { proxyToQuickwit } from '../../lib/quickwit/proxy.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';
import { NdjsonIngestResponse } from '../../schemas/responses/ingest.js';
import { badRequest } from '../../utils/http-error.js';

export const ndjsonRouter = new Hono<KeyedEnv>().post(
	'/ndjson',
	describe({
		tag: 'Log ingest',
		summary: 'Ingest NDJSON log documents',
		description:
			'Proxies an NDJSON log payload (one JSON object per line) to Quickwit for the index associated with the ingest API key. ' +
			'Accepts application/x-ndjson or application/json content-type. ' +
			'Success and 4xx responses are passed through from Quickwit; lines that fail to parse or match the schema ' +
			'are counted in num_rejected_docs of a 200 response. ' +
			'Upstream 5xx responses are mapped to the standard 503 error contract.',
		ok: NdjsonIngestResponse,
		okDescription: 'Documents accepted for processing',
		security: [{ ingestBearer: [] }],
		errors: [413, 429]
	}),
	requireIngestKey,
	async (c) => {
		const apiKey = c.get('apiKey');
		if (apiKey.indexId === config.traceIndexId) {
			throw badRequest(
				'This key targets the span store. Send spans to POST /v1/traces instead.',
				'INDEX_IS_TRACE_INDEX'
			);
		}
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
