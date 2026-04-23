import { json, type RequestHandler } from '@sveltejs/kit';

import { MAX_INGEST_BODY_BYTES } from '$lib/constants/ingest';
import { config } from '$lib/server/config';
import { verifyIngestToken } from '$lib/server/services/ingest-token.service';
import { extractBearerToken } from '$lib/server/utils/bearer';

export const POST: RequestHandler = async ({ params, request }) => {
	const indexId = (params as { indexId: string }).indexId;
	const search = new URL(request.url).search;
	const token = extractBearerToken(request.headers.get('authorization'));
	if (!token) {
		return json({ message: 'Missing bearer token' }, { status: 401 });
	}

	const verifiedToken = verifyIngestToken(token);
	if (!verifiedToken || verifiedToken.indexId !== indexId) {
		return json({ message: 'Invalid ingest token' }, { status: 403 });
	}

	const contentLength = request.headers.get('content-length');
	if (contentLength) {
		const parsedLength = Number.parseInt(contentLength, 10);
		if (Number.isFinite(parsedLength) && parsedLength > MAX_INGEST_BODY_BYTES) {
			return json({ message: 'Request body too large' }, { status: 413 });
		}
	}

	const body = await request.arrayBuffer();
	if (body.byteLength > MAX_INGEST_BODY_BYTES) {
		return json({ message: 'Request body too large' }, { status: 413 });
	}
	if (body.byteLength === 0) {
		return json({ message: 'Request body is required' }, { status: 400 });
	}

	const quickwitBase = config.quickwitUrl.replace(/\/+$/, '');
	const endpoint = `${quickwitBase}/${encodeURIComponent(indexId)}/ingest${search}`;

	try {
		const upstream = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'content-type': request.headers.get('content-type') ?? 'application/json'
			},
			body
		});
		const responseBody = await upstream.text();
		const headers = new Headers();
		const contentType = upstream.headers.get('content-type');
		if (contentType) {
			headers.set('content-type', contentType);
		}
		return new Response(responseBody, { status: upstream.status, headers });
	} catch {
		return json({ message: 'Failed to forward ingest request' }, { status: 502 });
	}
};
