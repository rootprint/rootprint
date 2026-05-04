import { json } from '@sveltejs/kit';

import { quickwitClient } from '$lib/server/quickwit';
import { verifyIngestToken } from '$lib/server/services/ingest-token.service';
import { extractBearerToken } from '$lib/server/utils/bearer';
import { readBoundedIngestBody } from '$lib/server/utils/ingest-body';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const { indexId } = params;
	const search = new URL(request.url).search;
	const token = extractBearerToken(request.headers.get('authorization'));
	if (!token) {
		return json({ message: 'Missing bearer token' }, { status: 401 });
	}

	const verifiedToken = verifyIngestToken(token);
	if (!verifiedToken || verifiedToken.indexId !== indexId) {
		return json({ message: 'Invalid ingest token' }, { status: 403 });
	}

	const bodyOrResponse = await readBoundedIngestBody(request);
	if (bodyOrResponse instanceof Response) return bodyOrResponse;

	const endpoint = `${quickwitClient.endpoint}/${encodeURIComponent(indexId)}/ingest${search}`;

	try {
		const upstream = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'content-type': request.headers.get('content-type') ?? 'application/json'
			},
			body: bodyOrResponse
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
