import { Hono } from 'hono';
import type { Handler } from 'hono';

import { config } from '../../config.js';
import { CONTENT_TYPE_PROTOBUF } from '../../constants.js';
import type { KeyedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwitUrl } from '../../lib/quickwit.js';
import { proxyToQuickwit, readUpstreamMessage } from '../../lib/quickwit-proxy.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';
import { badRequest, HttpError, unsupportedMediaType } from '../../utils/http-error.js';
import { otlpSuccess } from '../../utils/otlp-response.js';

type Signal = 'logs' | 'traces';

const SIGNALS = {
	logs: { pkg: 'logs', proto: 'Logs', docsHint: ' See /send-logs/otlp for details.' },
	traces: { pkg: 'trace', proto: 'Trace', docsHint: '' }
} as const satisfies Record<Signal, { pkg: string; proto: string; docsHint: string }>;

function parseBaseMediaType(header: string | undefined): string | null {
	if (!header) return null;
	const [base] = header.split(';');
	const trimmed = base?.trim().toLowerCase();
	return trimmed ? trimmed : null;
}

const binary = (description: string) => ({ type: 'string', format: 'binary', description });

const pbErr = (description: string) => ({
	description,
	content: { 'application/x-protobuf': { schema: binary('google.rpc.Status (protobuf)') } }
});

// Replaces the shared JSON error baseline. No 500: otlpErrorFromHttpError clamps 5xx to 503, the
// status OTLP clients treat as retryable.
const OTLP_ERRORS = {
	'400': pbErr('Upstream rejected the request'),
	'401': pbErr('Missing ingest bearer token'),
	'403': pbErr('Invalid ingest bearer token'),
	'404': pbErr('Route not found'),
	'413': pbErr('Payload too large'),
	'415': {
		// The one JSON error: an exporter sending the wrong content-type may not decode protobuf back.
		description:
			'Unsupported content-type (only application/x-protobuf accepted) — google.rpc.Status (JSON)',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					description: 'google.rpc.Status',
					properties: {
						code: { type: 'integer', description: 'gRPC status code' },
						message: { type: 'string', description: 'Human-readable error message' }
					}
				}
			}
		}
	},
	'429': pbErr('Upstream rate limit exceeded — honour retry-after'),
	'503': pbErr('Upstream unavailable. Every upstream 5xx is reported as 503')
};

function signalDescribe(signal: Signal) {
	const { pkg, proto, docsHint } = SIGNALS[signal];
	return describe({
		tag: signal === 'logs' ? 'Log ingest' : 'Trace ingest',
		summary: `Ingest OTLP ${signal} (protobuf)`,
		description:
			`OTLP/HTTP ${signal} exporter endpoint. Accepts only application/x-protobuf ` +
			`(Export${proto}ServiceRequest). ` +
			(signal === 'traces'
				? 'Spans go to the single span store named by TRACE_INDEX_ID, not to the ingest key’s index. '
				: 'The destination index comes from the ingest key. ') +
			'Quickwit ' +
			'answers with JSON, so the response is re-encoded as protobuf, preserving the ' +
			'partial_success count of rejected records. ' +
			'Errors use the google.rpc.Status encoding: 415 is JSON, everything else is binary protobuf.' +
			docsHint,
		security: [{ ingestBearer: [] }],
		requestBody: {
			required: true,
			content: {
				'application/x-protobuf': {
					schema: binary(
						`Serialised opentelemetry.proto.collector.${pkg}.v1.Export${proto}ServiceRequest`
					)
				}
			}
		},
		baselineErrors: false,
		rawResponses: {
			'200': {
				description:
					`Accepted. Export${proto}ServiceResponse — empty when every record was accepted, or ` +
					'carrying partial_success when Quickwit rejected some.',
				content: {
					'application/x-protobuf': {
						schema: binary(
							`Serialised opentelemetry.proto.collector.${pkg}.v1.Export${proto}ServiceResponse`
						)
					}
				}
			},
			...OTLP_ERRORS
		}
	});
}

function signalHandler(signal: Signal): Handler<KeyedEnv> {
	const { pkg, docsHint } = SIGNALS[signal];
	const unsupportedMessage =
		'Only application/x-protobuf is accepted. If you are using ' +
		`@opentelemetry/exporter-${pkg}-otlp-http (defaults to JSON), switch to ` +
		`@opentelemetry/exporter-${pkg}-otlp-proto.${docsHint}`;
	const indexHeader = `qw-otel-${signal}-index`;

	return async (c) => {
		const baseType = parseBaseMediaType(c.req.header('content-type'));
		if (baseType !== CONTENT_TYPE_PROTOBUF) {
			throw unsupportedMediaType(unsupportedMessage, 'CONTENT_TYPE_UNSUPPORTED');
		}

		const apiKey = c.get('apiKey');
		if (signal !== 'traces' && apiKey.indexId === config.traceIndexId) {
			throw badRequest(
				'This key targets the span store. Send spans to POST /v1/traces instead.',
				'INDEX_IS_TRACE_INDEX'
			);
		}
		const destinationIndex = signal === 'traces' ? config.traceIndexId : apiKey.indexId;
		const upstreamUrl = quickwitUrl(`/api/v1/otlp/v1/${signal}`);
		const headers: Record<string, string> = {
			'content-type': CONTENT_TYPE_PROTOBUF,
			[indexHeader]: destinationIndex
		};
		const ce = c.req.header('content-encoding');
		if (ce) headers['content-encoding'] = ce;

		const result = await proxyToQuickwit(c, { upstreamUrl, headers });

		if (result.status >= 400) {
			// Preserve the upstream status: 413 and 429 mean different things to an exporter than 400.
			throw new HttpError(
				result.status,
				result.status === 429 ? 'UPSTREAM_RATE_LIMIT' : 'UPSTREAM_REJECTED',
				readUpstreamMessage(result.bodyBytes, 'Upstream rejected request'),
				undefined,
				result.headers.get('retry-after') ?? undefined
			);
		}

		return otlpSuccess(signal, result.bodyBytes);
	};
}

export const otlpRouter = new Hono<KeyedEnv>()
	.post('/logs', signalDescribe('logs'), requireIngestKey, signalHandler('logs'))
	.post('/traces', signalDescribe('traces'), requireIngestKey, signalHandler('traces'));
