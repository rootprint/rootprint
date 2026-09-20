import { beforeEach, expect, test } from 'bun:test';

import { pickForwardedIp } from '../src/middleware/rate-limit.js';
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

test('the client IP is read from X-Forwarded-For only for trusted hops', () => {
	const peer = '127.0.0.1';
	expect(pickForwardedIp('9.9.9.9', peer, 0)).toBe(peer);
	expect(pickForwardedIp(undefined, peer, 1)).toBe(peer);
	expect(pickForwardedIp('9.9.9.9', peer, 1)).toBe('9.9.9.9');
	expect(pickForwardedIp('1.1.1.1, 2.2.2.2', peer, 1)).toBe('2.2.2.2');
	expect(pickForwardedIp('1.1.1.1, 2.2.2.2', peer, 2)).toBe('1.1.1.1');
});
