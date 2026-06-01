import { Hono } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_PROTOBUF } from '../../constants.js';
import type { AppEnv } from '../../env.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';
import {
	badRequest,
	serviceUnavailable,
	tooManyRequests,
	unsupportedMediaType
} from '../../utils/http-error.js';
import { otlpSuccess, readUpstreamMessage } from '../../utils/otlp-response.js';
import { proxyToQuickwit } from '../../utils/quickwit-proxy.js';

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

export const otlpRouter = new Hono<AppEnv>().post('/logs', requireIngestKey, async (c) => {
	const baseType = parseBaseMediaType(c.req.header('content-type'));
	if (baseType !== CONTENT_TYPE_PROTOBUF) {
		throw unsupportedMediaType(UNSUPPORTED_CONTENT_TYPE_MESSAGE, 'CONTENT_TYPE_UNSUPPORTED');
	}

	const apiKey = c.get('apiKey')!;
	const upstreamUrl = `${config.quickwitUrl}/api/v1/otlp/v1/logs`;
	const headers: Record<string, string> = {
		'content-type': CONTENT_TYPE_PROTOBUF,
		'qw-otel-logs-index': apiKey.indexId
	};
	const ce = c.req.header('content-encoding');
	if (ce) headers['content-encoding'] = ce;

	const result = await proxyToQuickwit(c, { upstreamUrl, headers });

	if (result.status >= 500) {
		throw serviceUnavailable('Upstream unavailable', 'UPSTREAM_UNAVAILABLE');
	}
	if (result.status === 429) {
		const retryAfter = result.headers.get('retry-after') ?? undefined;
		const msg = await readUpstreamMessage(new Response(result.bodyBytes), 'Upstream rate limit');
		throw tooManyRequests(msg, 'UPSTREAM_RATE_LIMIT', retryAfter);
	}
	if (result.status >= 400) {
		const msg = await readUpstreamMessage(
			new Response(result.bodyBytes),
			'Upstream rejected request'
		);
		throw badRequest(msg, 'UPSTREAM_REJECTED');
	}
	return otlpSuccess();
});
