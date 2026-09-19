import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { account } from '../src/db/schema.js';
import { db } from '../src/lib/db.js';
import { resetDb } from './helpers/db.js';
import { hasSession, providers, seedAdmin, sessionUser } from './helpers/fixtures.js';
import { Jar } from './helpers/http.js';
import { callbackWith, redirectError, startSocial } from './helpers/oauth.js';
import { resetOutbound } from './helpers/outbound.js';
import { GITHUB_CLIENT, GOOGLE_CLIENT, mockGithub, mockGoogle } from './helpers/providers.js';

beforeEach(resetDb);
afterEach(resetOutbound);

async function configureGoogle(admin: Jar, domains: string[]) {
	expect((await admin.put('/api/settings/auth/google/credentials', GOOGLE_CLIENT)).status).toBe(
		204
	);
	if (domains.length) {
		const res = await admin.put('/api/settings/auth/google/allowed-domains', {
			allowedDomains: domains
		});
		expect(res.status).toBe(204);
	}
}

async function configureGithub(admin: Jar, orgs: string[]) {
	expect((await admin.put('/api/settings/auth/github/credentials', GITHUB_CLIENT)).status).toBe(
		204
	);
	if (orgs.length) {
		const res = await admin.put('/api/settings/auth/github/allowed-orgs', { allowedOrgs: orgs });
		expect(res.status).toBe(204);
	}
}

async function socialCallback(provider: 'google' | 'github') {
	const jar = new Jar();
	const res = await callbackWith(jar, provider, await startSocial(jar, provider));
	expect(res.status).toBe(302);
	return { jar, res };
}

describe('google', () => {
	test('an allowed domain signs in', async () => {
		const admin = await seedAdmin();
		await configureGoogle(admin, ['example.com']);
		await mockGoogle({ sub: 'g-1', email: 'goo@example.com' });
		const { jar, res } = await socialCallback('google');
		expect(redirectError(res)).toBeNull();
		expect((await sessionUser(jar))?.email).toBe('goo@example.com');
	});

	test('a disallowed domain is domain_not_allowed', async () => {
		const admin = await seedAdmin();
		await configureGoogle(admin, ['example.com']);
		await mockGoogle({ sub: 'g-2', email: 'goo@other.test' });
		const { jar, res } = await socialCallback('google');
		expect(redirectError(res)).toBe('domain_not_allowed');
		expect(hasSession(jar)).toBe(false);
	});

	test('an empty allow-list rejects everyone and hides the button', async () => {
		const admin = await seedAdmin();
		await configureGoogle(admin, []);
		expect((await providers()).google.enabled).toBe(false);
		await mockGoogle({ sub: 'g-3', email: 'goo@example.com' });
		const { res } = await socialCallback('google');
		expect(redirectError(res)).toBe('domain_not_allowed');
	});

	test('an ID token without an email is rejected', async () => {
		const admin = await seedAdmin();
		await configureGoogle(admin, ['example.com']);
		await mockGoogle({ sub: 'g-4' });
		const { jar, res } = await socialCallback('google');
		// Better Auth rejects the token before validateUserInfo runs, so the domain check never sees it.
		expect(redirectError(res)).toBe('email_not_found');
		expect(hasSession(jar)).toBe(false);
	});
});

describe('github', () => {
	test('a member of an allowed org signs in', async () => {
		const admin = await seedAdmin();
		await configureGithub(admin, ['acme']);
		mockGithub({ login: 'octo', email: 'octo@example.com', orgs: ['Acme'] });
		const { jar, res } = await socialCallback('github');
		expect(redirectError(res)).toBeNull();
		expect((await sessionUser(jar))?.email).toBe('octo@example.com');
	});

	test('a non-member is org_not_allowed', async () => {
		const admin = await seedAdmin();
		await configureGithub(admin, ['acme']);
		mockGithub({ login: 'octo', email: 'octo@example.com', orgs: ['other-org'] });
		const { jar, res } = await socialCallback('github');
		expect(redirectError(res)).toBe('org_not_allowed');
		expect(hasSession(jar)).toBe(false);
	});

	test('a GitHub outage is oauth_check_unavailable, not a rejection', async () => {
		const admin = await seedAdmin();
		await configureGithub(admin, ['acme']);
		mockGithub({ login: 'octo', email: 'octo@example.com', orgs: 'error' });
		const { jar, res } = await socialCallback('github');
		expect(redirectError(res)).toBe('oauth_check_unavailable');
		expect(hasSession(jar)).toBe(false);
	});

	test('an empty org list rejects everyone and hides the button', async () => {
		const admin = await seedAdmin();
		await configureGithub(admin, []);
		expect((await providers()).github.enabled).toBe(false);
		mockGithub({ login: 'octo', email: 'octo@example.com', orgs: ['acme'] });
		const { res } = await socialCallback('github');
		expect(redirectError(res)).toBe('org_not_allowed');
	});
});

test('removing a provider revokes its sessions and hides its button', async () => {
	const admin = await seedAdmin();
	await configureGithub(admin, ['acme']);
	mockGithub({ login: 'octo', email: 'octo@example.com', orgs: ['acme'] });
	const { jar } = await socialCallback('github');
	expect(await sessionUser(jar)).not.toBeNull();

	expect((await admin.delete('/api/settings/auth/github/credentials')).status).toBe(204);
	expect(await sessionUser(jar)).toBeNull();
	expect((await providers()).github.enabled).toBe(false);
	// The account row stays: re-adding the provider re-links the same person.
	expect(await db.select().from(account).where(eq(account.providerId, 'github'))).toHaveLength(1);
});
