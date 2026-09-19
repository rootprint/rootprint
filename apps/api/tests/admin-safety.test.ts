import { beforeEach, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { account, apikey, inviteToken, session } from '../src/db/schema.js';
import { auth } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';
import { resetDb } from './helpers/db.js';
import { createActiveMember, seedAdmin, sessionUser } from './helpers/fixtures.js';
import { errorCode } from './helpers/http.js';

beforeEach(resetDb);

test('the only admin cannot delete, demote or password-reset themselves', async () => {
	const admin = await seedAdmin();
	const me = (await sessionUser(admin))?.id ?? '';

	const del = await admin.delete(`/api/users/${me}`);
	expect(del.status).toBe(400);
	expect(await errorCode(del)).toBe('BAD_REQUEST');

	expect((await admin.put(`/api/users/${me}/role`, { role: 'user' })).status).toBe(400);
	expect((await admin.post(`/api/users/${me}/password-resets`, {})).status).toBe(400);
	expect((await sessionUser(admin))?.role).toBe('admin');
});

test('deleting a user cascades sessions, accounts, invites and API keys', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);
	expect((await admin.post(`/api/users/${m.id}/invites`, {})).status).toBe(200);
	type CreateKey = (o: { body: Record<string, unknown> }) => Promise<{ id: string }>;
	await (auth().api as unknown as { createApiKey: CreateKey }).createApiKey({
		body: { name: 'cli', userId: m.id }
	});

	const counts = async () => ({
		sessions: (await db.select().from(session).where(eq(session.userId, m.id))).length,
		accounts: (await db.select().from(account).where(eq(account.userId, m.id))).length,
		invites: (await db.select().from(inviteToken).where(eq(inviteToken.userId, m.id))).length,
		keys: (await db.select().from(apikey).where(eq(apikey.referenceId, m.id))).length
	});
	expect(await counts()).toEqual({ sessions: 1, accounts: 1, invites: 1, keys: 1 });

	expect((await admin.delete(`/api/users/${m.id}`)).status).toBe(204);
	expect(await counts()).toEqual({ sessions: 0, accounts: 0, invites: 0, keys: 0 });
});
