import type { Context } from 'hono';

import type { ProxyResult } from '../types.js';
import { badRequest, serviceUnavailable } from '../utils/http-error.js';

const PROXY_TIMEOUT_MS = 120_000;

/** Quickwit reports errors as `{message}` JSON; anything else is surfaced as clipped raw text. */
export function readUpstreamMessage(bodyBytes: ArrayBuffer, fallback: string): string {
	const text = new TextDecoder().decode(bodyBytes);
	if (!text) return fallback;
	try {
		const parsed = JSON.parse(text) as unknown;
		if (
			parsed &&
			typeof parsed === 'object' &&
			'message' in parsed &&
			typeof (parsed as { message: unknown }).message === 'string'
		) {
			return (parsed as { message: string }).message;
		}
	} catch {
		// body was not JSON; fall through to raw text
	}
	return text.length > 512 ? text.slice(0, 512) : text;
}

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

	if (len === null && !sawAnyBytes()) {
		await upstream.body?.cancel().catch(() => {});
		throw badRequest('Request body is required', 'EMPTY_BODY');
	}

	if (upstream.status >= 500) {
		const errBytes = await upstream.arrayBuffer().catch(() => new ArrayBuffer(0));
		throw serviceUnavailable(
			readUpstreamMessage(errBytes, 'Upstream unavailable'),
			'UPSTREAM_UNAVAILABLE'
		);
	}
	const bodyBytes = await upstream.arrayBuffer();
	return { status: upstream.status, headers: upstream.headers, bodyBytes };
}
