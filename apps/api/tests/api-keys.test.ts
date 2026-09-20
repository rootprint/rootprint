import { beforeEach, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { apikey } from '../src/db/schema.js';
import { db } from '../src/lib/db.js';
import { resetDb } from './helpers/db.js';
import { createApiKeyDirect, seedAdmin } from './helpers/fixtures.js';
import { Jar, bearer, errorCode, json } from './helpers/http.js';

beforeEach(resetDb);

async function serviceKey(
	admin: Jar,
	permissions?: Record<string, string[]>
): Promise<{ id: string; token: string; userId: string }> {
	const sa = await json<{ id: string }>(
		await admin.post('/api/service-accounts', { name: 'ci-bot' })
	);
	if (!permissions) {
		const res = await admin.post('/api/api-keys/service-account', {
			name: 'ci-key',
			userId: sa.id
		});
		expect(res.status).toBe(201);
		const k = await json<{ id: string; token: string }>(res);
		return { ...k, userId: sa.id };
	}
	const k = await createApiKeyDirect({ name: 'ci-key', userId: sa.id, permissions });
	return { id: k.id, token: k.key, userId: sa.id };
}

// The compose Quickwit persists its data volume across runs, so this index can already exist
// from an earlier run even though resetDb only truncates Postgres. A real Quickwit's already-
// exists response for this route is 400 QUICKWIT_VALIDATION (the metastore message reads
// `already exist(s)`, which doesn't match the service's own `/already exists/i` conflict check),
// not the 409 INDEX_EXISTS that check otherwise maps a conflict to.
async function ensureAppLogsIndex(admin: Jar): Promise<void> {
	const res = await admin.post('/api/indexes', {
		indexId: 'app-logs',
		timestampField: 'timestamp',
		fieldMappings: [
			{ name: 'timestamp', type: 'datetime' },
			{ name: 'message', type: 'text' }
		]
	});
	if (res.status === 201) return;
	const body = await json<{ error?: { code?: string; message?: string } }>(res);
	if (res.status === 400 && body.error?.code === 'QUICKWIT_VALIDATION') {
		if (/already exist/i.test(body.error.message ?? '')) return;
	}
	throw new Error(`could not ensure app-logs index: ${res.status} ${JSON.stringify(body)}`);
}

const ndjsonAs = (token: string) =>
	new Jar().fetch('/api/ingest/ndjson', {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
		body: '{"message":"hi"}\n'
	});

// @better-auth/api-key reports a permission mismatch as KEY_NOT_FOUND and a missing row as
// INVALID_API_KEY, so the middleware yields 403 for under-scoped or disabled keys and 401 for
// tokens that match no row at all.
test('a logs:read key reaches a read route', async () => {
	const admin = await seedAdmin();
	const k = await serviceKey(admin);
	expect((await new Jar().get('/api/indexes', bearer(k.token))).status).toBe(200);
});

test('an under-scoped key is 403 PERSONAL_KEY_FORBIDDEN', async () => {
	const admin = await seedAdmin();
	const k = await serviceKey(admin, { metrics: ['read'] });
	const res = await new Jar().get('/api/indexes', bearer(k.token));
	expect(res.status).toBe(403);
	expect(await errorCode(res)).toBe('PERSONAL_KEY_FORBIDDEN');
});

test('a disabled key is 403; an unknown token is 401', async () => {
	const admin = await seedAdmin();
	const k = await serviceKey(admin);
	await db.update(apikey).set({ enabled: false }).where(eq(apikey.id, k.id));
	const disabled = await new Jar().get('/api/indexes', bearer(k.token));
	expect(disabled.status).toBe(403);
	expect(await errorCode(disabled)).toBe('PERSONAL_KEY_FORBIDDEN');

	const unknown = await new Jar().get('/api/indexes', bearer('rpk_definitely-not-a-key'));
	expect(unknown.status).toBe(401);
	expect(await errorCode(unknown)).toBe('PERSONAL_KEY_INVALID');
});

test('deleting the owner removes the key, so the token is 401', async () => {
	const admin = await seedAdmin();
	const k = await serviceKey(admin);
	expect((await admin.delete(`/api/service-accounts/${k.userId}`)).status).toBe(204);
	expect((await new Jar().get('/api/indexes', bearer(k.token))).status).toBe(401);
});

test('a bearer token wins over a valid cookie', async () => {
	const admin = await seedAdmin();
	const k = await serviceKey(admin, { metrics: ['read'] });
	expect((await admin.get('/api/indexes')).status).toBe(200);
	expect((await admin.get('/api/indexes', bearer(k.token))).status).toBe(403);
});

test('ingest and personal keys are not interchangeable', async () => {
	const admin = await seedAdmin();
	await ensureAppLogsIndex(admin);
	const ingest = await json<{ token: string }>(
		await admin.post('/api/api-keys', { name: 'shipper', indexId: 'app-logs' })
	);
	const personal = await serviceKey(admin);
	expect((await ndjsonAs(ingest.token)).status).toBe(200);

	const wrongKind = await ndjsonAs(personal.token);
	expect(wrongKind.status).toBe(403);
	expect(await errorCode(wrongKind)).toBe('INGEST_INVALID_TOKEN');

	expect((await new Jar().get('/api/indexes', bearer(ingest.token))).status).toBe(401);
});

test('the ingest key list exposes only the stored prefix', async () => {
	const admin = await seedAdmin();
	const created = await json<{ token: string }>(
		await admin.post('/api/api-keys', { name: 'shipper', indexId: 'app-logs' })
	);
	const list = await json<{ tokenPrefix: string }[]>(await admin.get('/api/api-keys'));
	expect(list).toHaveLength(1);
	expect(list[0]?.tokenPrefix).toBe(created.token.slice(0, 12));
	expect(JSON.stringify(list)).not.toContain(created.token);

	const k = await serviceKey(admin);
	const saList = await json<Record<string, unknown>[]>(
		await admin.get('/api/api-keys/service-account')
	);
	expect(saList).toHaveLength(1);
	expect(JSON.stringify(saList)).not.toContain(k.token);
	const start = saList[0]?.start;
	expect(typeof start).toBe('string');
	expect((start as string).length).toBeLessThanOrEqual(10);
});

// verifyApiKey caches a hit for 60s, so revocation only works because deleteApiKey flushes that
// cache. The first ingest below is what puts the key in it.
test('a deleted ingest key stops working at once, not when its cache entry expires', async () => {
	const admin = await seedAdmin();
	await ensureAppLogsIndex(admin);
	const created = await json<{ summary: { id: number }; token: string }>(
		await admin.post('/api/api-keys', { name: 'shipper', indexId: 'app-logs' })
	);

	expect((await ndjsonAs(created.token)).status).toBe(200);
	expect((await admin.delete(`/api/api-keys/${created.summary.id}`)).status).toBe(204);

	const replay = await ndjsonAs(created.token);
	expect(replay.status).toBe(403);
	expect(await errorCode(replay)).toBe('INGEST_INVALID_TOKEN');
});
