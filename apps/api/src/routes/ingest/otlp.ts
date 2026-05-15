import { Hono } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_PROTOBUF } from '../../constants/ingest.js';
import type { AppEnv } from '../../env.js';
import { requireToken } from '../../middleware/require-token.js';
import { badRequest, unsupportedMediaType } from '../../utils/http-error.js';
import { Code, otlpError, otlpSuccess, readUpstreamMessage } from '../../utils/otlp-response.js';
import { tapBytes } from './tap-bytes.js';

const UNSUPPORTED_CONTENT_TYPE_MESSAGE =
	'Only application/x-protobuf is accepted. If you are using ' +
	'@opentelemetry/exporter-logs-otlp-http (defaults to JSON), switch to ' +
	'@opentelemetry/exporter-logs-otlp-proto. See /send-logs/otlp for details.';

function parseBaseMediaType(header: string | undefined): string | null {
	if (!header) return null;
	const [base] = header.split(';');
	const trimmed = base?.trim().toLowerCase();
	return trimmed ? trimmed : null;
}

export const otlpRouter = new Hono<AppEnv>();

otlpRouter.post('/logs', requireToken, async (c) => {
	const baseType = parseBaseMediaType(c.req.header('content-type'));
	if (baseType !== CONTENT_TYPE_PROTOBUF) {
		throw unsupportedMediaType(UNSUPPORTED_CONTENT_TYPE_MESSAGE, 'CONTENT_TYPE_UNSUPPORTED');
	}

	const token = c.get('token')!;
	const upstreamUrl = `${config.quickwitUrl}/api/v1/otlp/v1/logs`;
	const headers: Record<string, string> = {
		'content-type': CONTENT_TYPE_PROTOBUF,
		'qw-otel-logs-index': token.indexId
	};
	const ce = c.req.header('content-encoding');
	if (ce) headers['content-encoding'] = ce;

	const reqBody = c.req.raw.body;
	if (!reqBody) throw badRequest('Request body is required', 'EMPTY_BODY');

	const { body, sawAnyBytes } = tapBytes(reqBody);

	let upstream: Response;
	try {
		upstream = await fetch(upstreamUrl, {
			method: 'POST',
			headers,
			body,
			duplex: 'half'
		} as RequestInit);
	} catch {
		return otlpError(503, Code.UNAVAILABLE, 'Upstream unavailable', 5);
	}

	if (!sawAnyBytes()) {
		await upstream.arrayBuffer().catch(() => {});
		throw badRequest('Request body is required', 'EMPTY_BODY');
	}

	if (upstream.status >= 500) {
		return otlpError(503, Code.UNAVAILABLE, 'Upstream unavailable', 5);
	}
	if (upstream.status === 429) {
		const retryAfter = upstream.headers.get('retry-after') ?? undefined;
		const msg = await readUpstreamMessage(upstream, 'Upstream rate limit');
		return otlpError(429, Code.RESOURCE_EXHAUSTED, msg, retryAfter);
	}
	if (upstream.status >= 400) {
		const msg = await readUpstreamMessage(upstream, 'Upstream rejected request');
		return otlpError(upstream.status, Code.INVALID_ARGUMENT, msg);
	}
	return otlpSuccess();
});
