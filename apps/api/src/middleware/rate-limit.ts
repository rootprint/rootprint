import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';
import { rateLimiter } from 'hono-rate-limiter';

import { config } from '../config.js';
import type { AppEnv, AuthedEnv } from '../env.js';
import { tooManyRequests } from '../utils/http-error.js';

const RETRY_AFTER_SECONDS = Math.ceil(config.rateLimitWindowMs / 1000);
export function resolveClientIp(c: Context): string {
	const hops = config.trustedProxyHops;
	if (hops > 0) {
		const xff = c.req.header('x-forwarded-for');
		if (xff) {
			const entries = xff.split(',').map((h) => h.trim());
			return entries[entries.length - hops] ?? entries[0]!;
		}
	}
	return getConnInfo(c).remote.address ?? '0.0.0.0';
}

function rejectOverLimit(): never {
	throw tooManyRequests('Rate limit exceeded', 'TOO_MANY_REQUESTS', RETRY_AFTER_SECONDS);
}

export const publicAuthLimiter = rateLimiter<AppEnv>({
	windowMs: config.rateLimitWindowMs,
	limit: config.publicAuthRateLimit,
	standardHeaders: 'draft-6',
	keyGenerator: (c) => resolveClientIp(c),
	handler: rejectOverLimit
});

export const readLimiter = rateLimiter<AuthedEnv>({
	windowMs: config.rateLimitWindowMs,
	limit: config.readRateLimit,
	standardHeaders: 'draft-6',
	keyGenerator: (c) => `u:${c.get('session').user.id}`,
	handler: rejectOverLimit
});
