import type { Context } from 'hono';

import type { ProxyResult } from '../types.js';
import { badRequest, serviceUnavailable } from '../utils/http-error.js';

const PROXY_TIMEOUT_MS = 120_000;

type ProxyOpts = {
	upstreamUrl: string;
	headers: Record<string, string>;
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

function parseContentLength(header: string | undefined): number | null {
	if (!header) return null;
	const n = Number(header);
	if (!Number.isInteger(n) || n < 0) return null;
	return n;
}

export async function proxyToQuickwit(c: Context, opts: ProxyOpts): Promise<ProxyResult> {
	const reqBody = c.req.raw.body;
	if (!reqBody) throw badRequest('Request body is required', 'EMPTY_BODY');

	const len = parseContentLength(c.req.header('content-length'));
	if (len === 0) throw badRequest('Request body is required', 'EMPTY_BODY');

	const { body, sawAnyBytes } = tapBytes(reqBody);

	let upstream: Response;
	try {
		upstream = await fetch(opts.upstreamUrl, {
			method: 'POST',
			headers: opts.headers,
			body,
			duplex: 'half',
			signal: AbortSignal.timeout(PROXY_TIMEOUT_MS)
		} as RequestInit);
	} catch {
		throw serviceUnavailable('Upstream unavailable', 'UPSTREAM_UNAVAILABLE');
	}

	if (!sawAnyBytes()) {
		await upstream.body?.cancel().catch(() => {});
		throw badRequest('Request body is required', 'EMPTY_BODY');
	}

	if (upstream.status >= 500) {
		await upstream.body?.cancel().catch(() => {});
		throw serviceUnavailable('Upstream unavailable', 'UPSTREAM_UNAVAILABLE');
	}
	const bodyBytes = await upstream.arrayBuffer();
	return { status: upstream.status, headers: upstream.headers, bodyBytes };
}
