import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { AuthProvidersInfo } from 'api/types';
import type { SetupAdminInput, SetupPasswordInput } from 'api/schemas';

export type AuthBootstrap = {
	needsSetupAdmin: boolean;
};

export async function getBootstrap(): Promise<AuthBootstrap> {
	const res = await client.api.auth.bootstrap.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load auth bootstrap');
	return res.json() as Promise<AuthBootstrap>;
}

export type VerifyInviteResult =
	{ status: 'valid'; email: string } | { status: 'invalid' } | { status: 'expired' };

export async function verifyInvite(token: string): Promise<VerifyInviteResult> {
	const res = await client.api.auth['verify-invite'].$post({ json: { token } });
	if (!res.ok) {
		const err = await readApiError(res, 'Failed to verify invite');
		if (err.code === 'INVITE_EXPIRED') return { status: 'expired' };
		if (err.code === 'INVITE_INVALID') return { status: 'invalid' };
		throw err;
	}
	const { email } = (await res.json()) as { email: string };
	return { status: 'valid', email };
}

export async function setupPassword(input: SetupPasswordInput): Promise<void> {
	const res = await client.api.auth['setup-password'].$post({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to set password');
}

export async function setupAdmin(input: SetupAdminInput): Promise<void> {
	const res = await client.api.auth['setup-admin'].$post({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to create admin');
}

export async function listAuthProviders(): Promise<AuthProvidersInfo> {
	const fallback: AuthProvidersInfo = {
		google: { enabled: false },
		github: { enabled: false }
	};
	try {
		const res = await client.api.auth.providers.$get();
		if (!res.ok) return fallback;
		return (await res.json()) as AuthProvidersInfo;
	} catch (e) {
		console.warn('[auth] providers fetch failed; assuming no SSO', e);
		return fallback;
	}
}
