import { Hono } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_JSON } from '../../constants/ingest.js';
import type { AppEnv } from '../../env.js';
import { requireToken } from '../../middleware/require-token.js';
import { badRequest, serviceUnavailable } from '../../utils/http-error.js';
import { tapBytes } from './tap-bytes.js';

export const ndjsonRouter = new Hono<AppEnv>();

ndjsonRouter.post('/', requireToken, async (c) => {
  const token = c.get('token')!;
  const upstreamUrl = `${config.quickwitUrl}/api/v1/${encodeURIComponent(token.indexId)}/ingest`;
  const contentType = c.req.header('content-type') ?? CONTENT_TYPE_JSON;

  const headers: Record<string, string> = { 'content-type': contentType };
  const contentLength = c.req.header('content-length');
  if (contentLength) headers['content-length'] = contentLength;

  const reqBody = c.req.raw.body;
  if (!reqBody) throw badRequest('Request body is required', 'EMPTY_BODY');

  const { body, sawAnyBytes } = tapBytes(reqBody);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body,
      duplex: 'half',
    } as RequestInit);
  } catch {
    throw serviceUnavailable('Upstream unavailable', 'UPSTREAM_UNAVAILABLE');
  }

  if (!sawAnyBytes()) {
    await upstream.arrayBuffer().catch(() => {});
    throw badRequest('Request body is required', 'EMPTY_BODY');
  }

  const upstreamCt = upstream.headers.get('content-type');
  const upstreamBody = await upstream.arrayBuffer();
  const respHeaders: Record<string, string> = {};
  if (upstreamCt) respHeaders['content-type'] = upstreamCt;
  return new Response(upstreamBody, { status: upstream.status, headers: respHeaders });
});
