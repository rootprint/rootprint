import { json } from '@sveltejs/kit';

import { MAX_INGEST_BODY_BYTES } from '$lib/constants/ingest';

export async function readBoundedIngestBody(request: Request): Promise<ArrayBuffer | Response> {
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
	return body;
}
