import { fromJson, toBinary } from '@bufbuild/protobuf';
import type { DescMessage, JsonValue } from '@bufbuild/protobuf';
import { Hono } from 'hono';
import type { Context, Handler, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { gunzipSync } from 'node:zlib';

import { config } from '../../config.js';
import { CONTENT_TYPE_PROTOBUF } from '../../constants.js';
import type { KeyedEnv } from '../../env.js';
import { ExportLogsServiceRequestSchema } from '../../gen/opentelemetry/proto/collector/logs/v1/logs_service_pb.js';
import { ExportTraceServiceRequestSchema } from '../../gen/opentelemetry/proto/collector/trace/v1/trace_service_pb.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwitUrl } from '../../lib/quickwit/client.js';
import { proxyToQuickwit, readUpstreamMessage } from '../../lib/quickwit/proxy.js';
import { requireIngestKey } from '../../middleware/require-api-key.js';
import { badRequest, HttpError, unsupportedMediaType } from '../../utils/http-error.js';
import { otlpEncoding, otlpSuccess } from '../../utils/otlp-response.js';

type Signal = 'logs' | 'traces';

const SIGNALS = {
	logs: {
		pkg: 'logs',
		proto: 'Logs',
		docsHint: ' See /send-logs/otlp for details.',
		request: ExportLogsServiceRequestSchema
	},
	traces: { pkg: 'trace', proto: 'Trace', docsHint: '', request: ExportTraceServiceRequestSchema }
} as const satisfies Record<
	Signal,
	{ pkg: string; proto: string; docsHint: string; request: DescMessage }
>;

// Protobuf streams through to Quickwit untouched; JSON is buffered and transcoded in-process.
const MAX_JSON_BYTES = 10 * 1024 * 1024;

const jsonTooLarge = () =>
	new HttpError(
		413,
		'PAYLOAD_TOO_LARGE',
		'JSON bodies are limited to 10 MiB, before and after gzip decompression'
	);

const jsonBodyLimit = bodyLimit({
	maxSize: MAX_JSON_BYTES,
	onError: () => {
		throw jsonTooLarge();
	}
});

const limitJsonBody: MiddlewareHandler<KeyedEnv> = (c, next) =>
	otlpEncoding(c.req.header('content-type')) === 'json' ? jsonBodyLimit(c, next) : next();

const ID_HEX_LENGTHS = new Map([
	['trace_id', 32],
	['span_id', 16],
	['parent_span_id', 16]
]);
const HEX = /^[0-9a-f]*$/i;

// OTLP/JSON writes ids as hex, but protobuf-JSON reads bytes fields as base64 and would silently
// decode a hex id into the wrong bytes. Quickwit answers a wrong-length id with a 500, which
// exporters retry forever, so reject it here. Walks the schema so ids inside unknown fields,
// which OTLP/JSON must ignore, never fail the request.
function hexIdsToBase64(schema: DescMessage, node: unknown): void {
	if (typeof node !== 'object' || node === null) return;
	const obj = node as Record<string, unknown>;
	for (const field of schema.fields) {
		// protobuf-es also accepts the snake_case field names.
		const key = field.jsonName in obj ? field.jsonName : field.name;
		const value = obj[key];
		const length = ID_HEX_LENGTHS.get(field.name);
		if (field.message) {
			for (const item of Array.isArray(value) ? value : [value]) {
				hexIdsToBase64(field.message, item);
			}
		} else if (typeof value === 'string' && length !== undefined) {
			if (value !== '' && (value.length !== length || !HEX.test(value))) {
				throw badRequest(`${key} must be ${length} hex characters`, 'INVALID_OTLP_JSON');
			}
			obj[key] = Buffer.from(value, 'hex').toString('base64');
		}
	}
}

async function jsonToProtobuf(c: Context<KeyedEnv>, schema: DescMessage): Promise<Uint8Array> {
	let body = new Uint8Array(await c.req.arrayBuffer());
	const encoding = c.req.header('content-encoding')?.trim().toLowerCase();
	if (encoding === 'gzip') {
		try {
			body = gunzipSync(body, { maxOutputLength: MAX_JSON_BYTES });
		} catch (err) {
			throw err instanceof RangeError
				? jsonTooLarge()
				: badRequest('Body is not valid gzip', 'INVALID_GZIP');
		}
	} else if (encoding && encoding !== 'identity') {
		throw unsupportedMediaType(
			`Unsupported content-encoding "${encoding}". JSON bodies accept gzip or none.`,
			'CONTENT_ENCODING_UNSUPPORTED'
		);
	}

	try {
		const json: JsonValue = JSON.parse(new TextDecoder().decode(body));
		hexIdsToBase64(schema, json);
		return toBinary(schema, fromJson(schema, json, { ignoreUnknownFields: true }));
	} catch (err) {
		if (err instanceof HttpError) throw err;
		const reason = err instanceof Error ? err.message : 'unreadable body';
		throw badRequest(`Invalid OTLP/JSON: ${reason}`, 'INVALID_OTLP_JSON');
	}
}

const binary = (description: string) => ({
	type: 'string' as const,
	format: 'binary',
	description
});

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
	const { docsHint, request } = SIGNALS[signal];
	const unsupportedMessage = 'Unsupported content-type. Send application/x-protobuf.' + docsHint;
	const indexHeader = `qw-otel-${signal}-index`;

	return async (c) => {
		const encoding = otlpEncoding(c.req.header('content-type'));
		if (!encoding) throw unsupportedMediaType(unsupportedMessage, 'CONTENT_TYPE_UNSUPPORTED');

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
		let body: Uint8Array | undefined;
		if (encoding === 'json') {
			body = await jsonToProtobuf(c, request);
			// OTLP says an empty request SHOULD succeed; {} encodes to zero bytes, which the proxy rejects.
			if (body.length === 0) return otlpSuccess(signal, new ArrayBuffer(0), true);
		} else {
			const contentLength = c.req.header('content-length');
			if (contentLength) headers['content-length'] = contentLength;
			const ce = c.req.header('content-encoding');
			if (ce) headers['content-encoding'] = ce;
		}

		const result = await proxyToQuickwit(c, { upstreamUrl, headers, body });

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

		return otlpSuccess(signal, result.bodyBytes, encoding === 'json');
	};
}

export const otlpRouter = new Hono<KeyedEnv>()
	.post('/logs', signalDescribe('logs'), requireIngestKey, limitJsonBody, signalHandler('logs'))
	.post(
		'/traces',
		signalDescribe('traces'),
		requireIngestKey,
		limitJsonBody,
		signalHandler('traces')
	);
