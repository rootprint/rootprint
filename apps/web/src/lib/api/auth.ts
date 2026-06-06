import { client } from '$lib/api/client';
import { ApiError, readApiError } from '$lib/api/errors';
import type { ApiErrorBody, AuthProvidersInfo } from 'api/types';
import type { SetupAdminInput, SetupPasswordInput } from 'api/schemas';

export type AuthBootstrap = {
	needsSetupAdmin: boolean;
};

export { ApiError as AuthApiError };

export async function getBootstrap(): Promise<AuthBootstrap> {
	const res = await client.api.auth.bootstrap.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load auth bootstrap');
	return res.json() as Promise<AuthBootstrap>;
}

export type VerifyInviteResult =
	| { status: 'valid'; email: string }
	| { status: 'invalid' }
	| { status: 'expired' };

/** Returns a discriminated union — never throws for known invalid/expired states. */
export async function verifyInvite(token: string): Promise<VerifyInviteResult> {
	const res = await client.api.auth['verify-invite'].$post({ json: { token } });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
		const message = body?.error.message?.toLowerCase() ?? '';
		return { status: message.includes('expire') ? 'expired' : 'invalid' };
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
	} catch {
		return fallback;
	}
}
