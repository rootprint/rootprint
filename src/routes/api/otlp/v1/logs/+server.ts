import { json, type RequestHandler } from '@sveltejs/kit';

import { config } from '$lib/server/config';
import { verifyIngestToken } from '$lib/server/services/ingest-token.service';

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB — on-the-wire size (compressed if Content-Encoding set)

type VerifyResult = { id: number; name: string; indexId: string } | null;

type ForwardArgs = {
	indexId: string;
	body: ArrayBuffer;
	contentType: string;
	contentEncoding: string | null;
};

type OtlpDependencies = {
	verifyToken: (token: string) => VerifyResult;
	forwardOtlp: (args: ForwardArgs) => Promise<Response>;
};

const SUPPORTED_MEDIA_TYPES = new Set(['application/x-protobuf']);

function extractBearerToken(authorizationHeader: string | null): string | null {
	if (!authorizationHeader) return null;
	const [scheme, ...tokenParts] = authorizationHeader.trim().split(/\s+/);
	if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
	const token = tokenParts.join(' ').trim();
	return token.length > 0 ? token : null;
}

function parseBaseMediaType(contentTypeHeader: string | null): string | null {
	if (!contentTypeHeader) return null;
	const [base] = contentTypeHeader.split(';');
	const trimmed = base?.trim().toLowerCase();
	return trimmed ? trimmed : null;
}

function buildUpstreamEndpoint(): string {
	const quickwitBase = config.quickwitUrl.replace(/\/+$/, '');
	return `${quickwitBase}/otlp/v1/logs`;
}

const defaultDependencies: OtlpDependencies = {
	verifyToken: verifyIngestToken,
	forwardOtlp: async ({ indexId, body, contentType, contentEncoding }) => {
		const headers: Record<string, string> = {
			'content-type': contentType,
			'qw-otel-logs-index': indexId
		};
		if (contentEncoding) {
			headers['content-encoding'] = contentEncoding;
		}
		return fetch(buildUpstreamEndpoint(), {
			method: 'POST',
			headers,
			body
		});
	}
};

export function _createOtlpLogsHandler(
	dependencies: OtlpDependencies = defaultDependencies
): RequestHandler {
	return async ({ request }) => {
		const token = extractBearerToken(request.headers.get('authorization'));
		if (!token) {
			return json({ message: 'Missing bearer token' }, { status: 401 });
		}

		const verified = dependencies.verifyToken(token);
		if (!verified) {
			return json({ message: 'Invalid ingest token' }, { status: 403 });
		}

		const contentTypeHeader = request.headers.get('content-type');
		const baseMediaType = parseBaseMediaType(contentTypeHeader);
		if (!baseMediaType || !SUPPORTED_MEDIA_TYPES.has(baseMediaType)) {
			return json(
				{
					message:
						'Only application/x-protobuf is accepted. If you are using @opentelemetry/exporter-logs-otlp-http (defaults to JSON), switch to @opentelemetry/exporter-logs-otlp-proto. See /send-logs/otlp for details.'
				},
				{ status: 415 }
			);
		}

		const contentLength = request.headers.get('content-length');
		if (contentLength) {
			const parsedLength = Number.parseInt(contentLength, 10);
			if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_BYTES) {
				return json({ message: 'Request body too large' }, { status: 413 });
			}
		}

		const body = await request.arrayBuffer();
		if (body.byteLength > MAX_BODY_BYTES) {
			return json({ message: 'Request body too large' }, { status: 413 });
		}
		if (body.byteLength === 0) {
			return json({ message: 'Request body is required' }, { status: 400 });
		}

		try {
			const upstream = await dependencies.forwardOtlp({
				indexId: verified.indexId,
				body,
				contentType: contentTypeHeader as string,
				contentEncoding: request.headers.get('content-encoding')
			});

			if (upstream.status >= 500) {
				return new Response(null, {
					status: 503,
					headers: { 'retry-after': '5' }
				});
			}
			if (upstream.status === 429) {
				const headers = new Headers();
				const retryAfter = upstream.headers.get('retry-after');
				if (retryAfter) headers.set('retry-after', retryAfter);
				return new Response(null, { status: 429, headers });
			}
			if (upstream.status >= 400) {
				const passthroughBody = await upstream.text();
				const headers = new Headers();
				const upstreamContentType = upstream.headers.get('content-type');
				if (upstreamContentType) headers.set('content-type', upstreamContentType);
				return new Response(passthroughBody, { status: upstream.status, headers });
			}

			// 2xx — success. Return empty 200 per §5 of the spec (deliberate non-compliance
			// with full OTLP response-body spec; see docs/superpowers/specs/2026-04-19-otel-ingest-endpoint-design.md §1 Compatibility scope).
			return new Response(null, { status: 200 });
		} catch {
			return new Response(null, {
				status: 503,
				headers: { 'retry-after': '5' }
			});
		}
	};
}

export const POST: RequestHandler = _createOtlpLogsHandler();
