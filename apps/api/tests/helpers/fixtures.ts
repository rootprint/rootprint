import { expect } from 'bun:test';

import type { AuthProvidersInfo } from '../../src/types.js';
import { Jar, json } from './http.js';

export const SESSION_COOKIE = 'better-auth.session_token';
export const ADMIN = {
	name: 'Ada Admin',
	email: 'ada@example.com',
	password: 'correct-horse-battery-staple'
};
export const MEMBER_EMAIL = 'mia@example.com';
export const MEMBER_PASSWORD = 'member-password-123';

export type SessionUser = { id: string; email: string; role: string | null };

export function hasSession(jar: Jar): boolean {
	return jar.cookies.has(SESSION_COOKIE);
}

export function signIn(jar: Jar, email: string, password: string): Promise<Response> {
	return jar.post('/api/auth/sign-in/email', { email, password });
}

export async function signedInAs(email: string, password: string): Promise<Jar> {
	const jar = new Jar();
	expect((await signIn(jar, email, password)).status).toBe(200);
	return jar;
}

/** Real first-admin flow, then signed in. */
export async function seedAdmin(): Promise<Jar> {
	const jar = new Jar();
	expect((await jar.post('/api/auth/setup-admin', ADMIN)).status).toBe(201);
	expect((await signIn(jar, ADMIN.email, ADMIN.password)).status).toBe(200);
	return jar;
}

export async function sessionUser(jar: Jar): Promise<SessionUser | null> {
	const body = await json<{ user?: SessionUser } | null>(await jar.get('/api/auth/get-session'));
	return body?.user ?? null;
}

export function inviteTokenOf(inviteUrl: string): string {
	const token = new URL(inviteUrl).searchParams.get('token');
	if (!token) throw new Error(`no token in ${inviteUrl}`);
	return token;
}

export async function createMember(
	admin: Jar,
	email = MEMBER_EMAIL,
	role: 'user' | 'admin' = 'user'
): Promise<{ id: string; token: string }> {
	const res = await admin.post('/api/users', { email, name: 'Mia Member', role });
	expect(res.status).toBe(201);
	const { inviteUrl } = await json<{ inviteUrl: string }>(res);
	const users = await json<{ id: string; email: string }[]>(await admin.get('/api/users'));
	const created = users.find((u) => u.email === email);
	if (!created) throw new Error(`user ${email} not listed after creation`);
	return { id: created.id, token: inviteTokenOf(inviteUrl) };
}

export async function acceptInvite(token: string, password = MEMBER_PASSWORD): Promise<void> {
	const res = await new Jar().post('/api/auth/setup-password', { token, password });
	expect(res.status).toBe(200);
}

export async function createActiveMember(
	admin: Jar,
	email = MEMBER_EMAIL,
	role: 'user' | 'admin' = 'user'
): Promise<{ id: string; jar: Jar }> {
	const { id, token } = await createMember(admin, email, role);
	await acceptInvite(token);
	return { id, jar: await signedInAs(email, MEMBER_PASSWORD) };
}

export async function providers(): Promise<AuthProvidersInfo> {
	return json<AuthProvidersInfo>(await new Jar().get('/api/auth/providers'));
}

export async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 3_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	// oxlint-disable-next-line no-await-in-loop
	while (!(await predicate())) {
		if (Date.now() > deadline) throw new Error(`condition not met within ${timeoutMs}ms`);
		// oxlint-disable-next-line no-await-in-loop
		await Bun.sleep(50);
	}
}
