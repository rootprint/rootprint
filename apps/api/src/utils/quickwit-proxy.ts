import type { Context } from 'hono';

import { badRequest, serviceUnavailable } from './http-error.js';

type ProxyOpts = {
	upstreamUrl: string;
	headers: Record<string, string>;
};

export type ProxyResult = {
	status: number;
	headers: Headers;
	bodyBytes: ArrayBuffer;
};

function tapBytes(input: ReadableStream<Uint8Array>): {
	body: ReadableStream<Uint8Array>;
	sawAnyBytes: () => boolean;
} {
	let seen = false;
	const body = input.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, ctrl) {
				if (chunk.byteLength > 0) seen = true;
				ctrl.enqueue(chunk);
			}
		})
	);
	return { body, sawAnyBytes: () => seen };
}

export async function proxyToQuickwit(c: Context, opts: ProxyOpts): Promise<ProxyResult> {
	const reqBody = c.req.raw.body;
	if (!reqBody) throw badRequest('Request body is required', 'EMPTY_BODY');

	const { body, sawAnyBytes } = tapBytes(reqBody);

	let upstream: Response;
	try {
		upstream = await fetch(opts.upstreamUrl, {
			method: 'POST',
			headers: opts.headers,
			body,
			duplex: 'half'
		} as RequestInit);
	} catch {
		throw serviceUnavailable('Upstream unavailable', 'UPSTREAM_UNAVAILABLE');
	}

	if (!sawAnyBytes()) {
		await upstream.arrayBuffer().catch(() => {});
		throw badRequest('Request body is required', 'EMPTY_BODY');
	}

	const bodyBytes = await upstream.arrayBuffer();
	return { status: upstream.status, headers: upstream.headers, bodyBytes };
}
