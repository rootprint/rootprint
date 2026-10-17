import type { Context, MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';
import type { Level } from 'pino';

import type { AppEnv } from '../env.js';
import { logger } from '../lib/logger.js';
import { resolveClientIp } from './rate-limit.js';

export function isApiPath(path: string): boolean {
	return path === '/api' || path === '/v1' || path.startsWith('/api/') || path.startsWith('/v1/');
}

/** Puts attributes on this request's single log line instead of writing a second line. */
export function addLogAttrs(c: Context, attrs: Record<string, unknown>): void {
	c.set('logAttrs', { ...c.get('logAttrs'), ...attrs });
}

function levelFor(path: string, statusCode: number, attrs: Record<string, unknown>): Level {
	if ('err' in attrs) return 'error';
	// A client that hung up is ordinary traffic, not a failed request.
	if (statusCode === 499) return 'info';
	const rejected = attrs['rootprint.ingest.rejected'];
	if (statusCode >= 400 || (typeof rejected === 'number' && rejected > 0)) return 'warn';
	return path === '/api/health' ? 'debug' : 'info';
}

function messageFor(
	c: Context,
	statusCode: number,
	durationMs: number,
	attrs: Record<string, unknown>
): string {
	let msg = `${c.req.method} ${c.req.path} ${statusCode} ${durationMs}ms`;
	if (typeof attrs['error.type'] === 'string') msg += ` ${attrs['error.type']}`;
	const rejected = attrs['rootprint.ingest.rejected'];
	if (typeof rejected === 'number' && rejected > 0) msg += ` (${rejected} rejected)`;
	return msg;
}

export const requestLogging: MiddlewareHandler<AppEnv> = async (c, next) => {
	const startedAt = performance.now();
	// Read before next(): once the client hangs up, Bun no longer knows its address.
	const clientAddress = resolveClientIp(c);
	// ponytail: hono runs app.onError before next() returns, so c.res holds the final status.
	// 500 survives only a non-Error throw, which bypasses onError the same way.
	let statusCode = 500;
	try {
		await next();
		statusCode = c.res.status;
	} catch (thrown) {
		addLogAttrs(c, { err: thrown });
		throw thrown;
	} finally {
		const attrs = c.get('logAttrs') ?? {};
		// SPA pages and assets would flood the log, so they get a line only when they fail.
		if (isApiPath(c.req.path) || 'err' in attrs) {
			const durationMs = Math.round(performance.now() - startedAt);
			const session = c.get('session');
			const apiKey = c.get('apiKey');
			const apiKeyActor = c.get('apiKeyActor');
			const userAgent = c.req.header('user-agent');
			const bodySize = Number(c.req.header('content-length'));
			logger[levelFor(c.req.path, statusCode, attrs)](
				{
					'http.request.method': c.req.method,
					'http.route': routePath(c),
					'url.path': c.req.path,
					'http.response.status_code': statusCode,
					duration_ms: durationMs,
					'client.address': clientAddress,
					...(userAgent ? { 'user_agent.original': userAgent } : {}),
					...(Number.isFinite(bodySize) ? { 'http.request.body.size': bodySize } : {}),
					...(session ? { 'user.id': session.user.id } : {}),
					...(apiKeyActor
						? { 'rootprint.api_key.id': apiKeyActor.keyId, 'rootprint.api_key.type': 'personal' }
						: {}),
					...(apiKey
						? { 'rootprint.api_key.id': String(apiKey.id), 'rootprint.api_key.type': 'ingest' }
						: {}),
					...attrs
				},
				messageFor(c, statusCode, durationMs, attrs)
			);
		}
	}
};
