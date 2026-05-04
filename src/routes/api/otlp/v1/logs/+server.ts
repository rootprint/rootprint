import { json, type RequestHandler } from '@sveltejs/kit';

import { quickwitClient } from '$lib/server/quickwit';
import { verifyIngestToken } from '$lib/server/services/ingest-token.service';
import { extractBearerToken } from '$lib/server/utils/bearer';
import { readBoundedIngestBody } from '$lib/server/utils/ingest-body';

const SUPPORTED_MEDIA_TYPES = new Set(['application/x-protobuf']);

function parseBaseMediaType(contentTypeHeader: string | null): string | null {
	if (!contentTypeHeader) return null;
	const [base] = contentTypeHeader.split(';');
	const trimmed = base?.trim().toLowerCase();
	return trimmed ? trimmed : null;
}

export const POST: RequestHandler = async ({ request }) => {
	const token = extractBearerToken(request.headers.get('authorization'));
	if (!token) {
		return json({ message: 'Missing bearer token' }, { status: 401 });
	}

	const verified = verifyIngestToken(token);
	if (!verified) {
		return json({ message: 'Invalid ingest token' }, { status: 403 });
	}

	const contentTypeHeader = request.headers.get('content-type') ?? '';
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

	const bodyOrResponse = await readBoundedIngestBody(request);
	if (bodyOrResponse instanceof Response) return bodyOrResponse;

	const headers: Record<string, string> = {
		'content-type': contentTypeHeader,
		'qw-otel-logs-index': verified.indexId
	};
	const contentEncoding = request.headers.get('content-encoding');
	if (contentEncoding) {
		headers['content-encoding'] = contentEncoding;
	}

	try {
		const upstream = await fetch(`${quickwitClient.endpoint}/otlp/v1/logs`, {
			method: 'POST',
			headers,
			body: bodyOrResponse
		});

		if (upstream.status >= 500) {
			return new Response(null, { status: 503, headers: { 'retry-after': '5' } });
		}
		if (upstream.status === 429) {
			const passthroughHeaders = new Headers();
			const retryAfter = upstream.headers.get('retry-after');
			if (retryAfter) passthroughHeaders.set('retry-after', retryAfter);
			return new Response(null, { status: 429, headers: passthroughHeaders });
		}
		if (upstream.status >= 400) {
			const passthroughBody = await upstream.text();
			const passthroughHeaders = new Headers();
			const upstreamContentType = upstream.headers.get('content-type');
			if (upstreamContentType) passthroughHeaders.set('content-type', upstreamContentType);
			return new Response(passthroughBody, {
				status: upstream.status,
				headers: passthroughHeaders
			});
		}

		// 2xx — success. Return empty 200 per §5 of the spec (deliberate non-compliance
		// with full OTLP response-body spec; see docs/superpowers/specs/2026-04-19-otel-ingest-endpoint-design.md §1 Compatibility scope).
		return new Response(null, { status: 200 });
	} catch {
		return new Response(null, { status: 503, headers: { 'retry-after': '5' } });
	}
};
