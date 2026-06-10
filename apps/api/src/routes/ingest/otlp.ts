import { Hono } from 'hono';

import { CONTENT_TYPE_PROTOBUF } from '../../constants.js';
import type { KeyedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwitUrl } from '../../lib/quickwit.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';
import { badRequest, tooManyRequests, unsupportedMediaType } from '../../utils/http-error.js';
import { otlpSuccess, readUpstreamMessage } from '../../utils/otlp-response.js';
import { proxyToQuickwit } from '../../lib/quickwit-proxy.js';

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

// google.rpc.Status JSON shape returned for 415 (unsupportedContentType uses JSON, not protobuf)
const googleRpcStatusSchema = {
	type: 'object',
	description: 'google.rpc.Status',
	properties: {
		code: { type: 'integer', description: 'gRPC status code' },
		message: { type: 'string', description: 'Human-readable error message' }
	}
};

// google.rpc.Status binary protobuf shape returned for 429/503/400
const protobufBinarySchema = {
	type: 'string',
	format: 'binary',
	description: 'google.rpc.Status serialised as application/x-protobuf'
};

export const otlpRouter = new Hono<KeyedEnv>().post(
	'/logs',
	describe({
		tag: 'Log ingest',
		summary: 'Ingest OTLP logs (protobuf)',
		description:
			'OTLP/HTTP log exporter endpoint. Accepts only application/x-protobuf ' +
			'(ExportLogsServiceRequest). Returns an ExportLogsServiceResponse on success. ' +
			'All error responses use the google.rpc.Status encoding: ' +
			'415 is JSON, all other errors are binary protobuf.',
		security: [{ ingestBearer: [] }],
		rawResponses: {
			'200': {
				description: 'Logs accepted — empty ExportLogsServiceResponse',
				content: {
					'application/x-protobuf': {
						schema: {
							type: 'string',
							format: 'binary',
							description:
								'Serialised opentelemetry.proto.collector.logs.v1.ExportLogsServiceResponse'
						}
					}
				}
			},
			'400': {
				description: 'Upstream rejected the request — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			},
			'401': {
				description: 'Missing or invalid ingest bearer token — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			},
			'403': {
				description: 'Ingest key does not have access to this index — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			},
			'404': {
				description: 'Route not found — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			},
			'415': {
				description:
					'Unsupported content-type (only application/x-protobuf accepted) — google.rpc.Status (JSON)',
				content: { 'application/json': { schema: googleRpcStatusSchema } }
			},
			'429': {
				description: 'Upstream rate limit exceeded — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			},
			'500': {
				description: 'Internal server error — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			},
			'503': {
				description: 'Upstream service unavailable — google.rpc.Status (protobuf)',
				content: { 'application/x-protobuf': { schema: protobufBinarySchema } }
			}
		}
	}),
	requireIngestKey,
	async (c) => {
		const baseType = parseBaseMediaType(c.req.header('content-type'));
		if (baseType !== CONTENT_TYPE_PROTOBUF) {
			throw unsupportedMediaType(UNSUPPORTED_CONTENT_TYPE_MESSAGE, 'CONTENT_TYPE_UNSUPPORTED');
		}

		const apiKey = c.get('apiKey');
		const upstreamUrl = quickwitUrl('/api/v1/otlp/v1/logs');
		const headers: Record<string, string> = {
			'content-type': CONTENT_TYPE_PROTOBUF,
			'qw-otel-logs-index': apiKey.indexId
		};
		const ce = c.req.header('content-encoding');
		if (ce) headers['content-encoding'] = ce;

		const result = await proxyToQuickwit(c, { upstreamUrl, headers });

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
	}
);
