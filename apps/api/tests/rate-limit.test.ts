import { beforeEach, expect, test } from 'bun:test';
import { Hono } from 'hono';

import { resolveClientIp } from '../src/middleware/rate-limit.js';
import { resetDb } from './helpers/db.js';
import { seedAdmin } from './helpers/fixtures.js';
import { Jar, errorCode } from './helpers/http.js';

beforeEach(resetDb);

test('public auth routes return 429 with Retry-After past the limit', async () => {
	const jar = new Jar();
	let last: Response | undefined;
	// oxlint-disable-next-line no-await-in-loop
	for (let i = 0; i < 31; i++) last = await jar.post('/api/auth/verify-invite', { token: 'nope' });
	expect(last?.status).toBe(429);
	expect(last?.headers.get('retry-after')).toBe('60');
	expect(await errorCode(last as Response)).toBe('TOO_MANY_REQUESTS');
});

test('authenticated routes are not affected by the public limiter', async () => {
	const admin = await seedAdmin();
	const statuses = await Promise.all(
		Array.from({ length: 31 }, () => admin.get('/api/users').then((r) => r.status))
	);
	expect(new Set(statuses)).toEqual(new Set([200]));
});

test('resolveClientIp honours X-Forwarded-For only for trusted hops', async () => {
	const app = new Hono().get('/:hops', (c) =>
		c.text(resolveClientIp(c, Number(c.req.param('hops'))))
	);
	const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: app.fetch });
	const at = (hops: number, xff: string) =>
		fetch(`http://127.0.0.1:${server.port}/${hops}`, {
			headers: { 'x-forwarded-for': xff }
		}).then((r) => r.text());
	try {
		expect(await at(0, '9.9.9.9')).toBe('127.0.0.1');
		expect(await at(1, '9.9.9.9')).toBe('9.9.9.9');
		expect(await at(1, '1.1.1.1, 2.2.2.2')).toBe('2.2.2.2');
		expect(await at(2, '1.1.1.1, 2.2.2.2')).toBe('1.1.1.1');
	} finally {
		server.stop(true);
	}
});
