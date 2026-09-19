import { beforeEach, expect, test } from 'bun:test';

import { inviteToken } from '../src/db/schema.js';
import { db } from '../src/lib/db.js';
import { expireInvite, resetDb } from './helpers/db.js';
import {
	MEMBER_EMAIL,
	MEMBER_PASSWORD,
	acceptInvite,
	createActiveMember,
	createMember,
	inviteTokenOf,
	seedAdmin,
	sessionUser,
	signIn,
	signedInAs
} from './helpers/fixtures.js';
import { Jar, errorCode, json } from './helpers/http.js';

beforeEach(resetDb);

const verify = (token: string) => new Jar().post('/api/auth/verify-invite', { token });
const setup = (token: string, password = MEMBER_PASSWORD) =>
	new Jar().post('/api/auth/setup-password', { token, password });

test('invite: verify, set password, sign in, and the token is single-use', async () => {
	const admin = await seedAdmin();
	const { token } = await createMember(admin);

	const v = await verify(token);
	expect(v.status).toBe(200);
	const vBody = await json(v);
	expect(vBody).toEqual({ valid: true, email: MEMBER_EMAIL });

	await acceptInvite(token);
	const member = await signedInAs(MEMBER_EMAIL, MEMBER_PASSWORD);
	expect((await sessionUser(member))?.role).toBe('user');

	const reuse = await setup(token, 'another-password-1');
	expect(reuse.status).toBe(400);
	expect(await errorCode(reuse)).toBe('INVITE_INVALID');
});

test('an expired invite is rejected on verify and on setup', async () => {
	const admin = await seedAdmin();
	const { token } = await createMember(admin);
	await expireInvite(token);

	const v = await verify(token);
	expect(v.status).toBe(400);
	expect(await errorCode(v)).toBe('INVITE_EXPIRED');
	expect(await errorCode(await setup(token))).toBe('INVITE_EXPIRED');
});

test('reissuing an invite invalidates the previous token', async () => {
	const admin = await seedAdmin();
	const { id, token } = await createMember(admin);
	const res = await admin.post(`/api/users/${id}/invites`, {});
	expect(res.status).toBe(200);
	const reissueBody = await json<{ inviteUrl: string }>(res);
	const fresh = inviteTokenOf(reissueBody.inviteUrl);

	expect(await errorCode(await verify(token))).toBe('INVITE_INVALID');
	expect((await verify(fresh)).status).toBe(200);
});

test('a service account cannot redeem an invite', async () => {
	const admin = await seedAdmin();
	const saRes = await admin.post('/api/service-accounts', { name: 'ci-bot' });
	const sa = await json<{ id: string }>(saRes);
	const issue = await admin.post(`/api/users/${sa.id}/invites`, {});
	expect(issue.status).toBe(404);
	await db.insert(inviteToken).values({
		userId: sa.id,
		token: 'svc-token-0000',
		expiresAt: new Date(Date.now() + 3_600_000)
	});
	expect(await errorCode(await verify('svc-token-0000'))).toBe('INVITE_INVALID');
});

test('password reset revokes sessions and replaces the credential', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);

	const res = await admin.post(`/api/users/${m.id}/password-resets`, {});
	expect(res.status).toBe(200);

	expect((await m.jar.get('/api/indexes')).status).toBe(401);
	expect((await signIn(new Jar(), MEMBER_EMAIL, MEMBER_PASSWORD)).status).toBe(401);

	const resetBody = await json<{ inviteUrl: string }>(res);
	const token = inviteTokenOf(resetBody.inviteUrl);
	await acceptInvite(token, 'brand-new-password-1');
	expect((await signIn(new Jar(), MEMBER_EMAIL, 'brand-new-password-1')).status).toBe(200);
});

test('password reset is refused while password sign-in is disabled', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);
	expect((await admin.put('/api/settings/auth/password', { enabled: false })).status).toBe(204);

	const res = await admin.post(`/api/users/${m.id}/password-resets`, {});
	expect(res.status).toBe(400);
	expect(await errorCode(res)).toBe('PASSWORD_SIGN_IN_DISABLED');
});
