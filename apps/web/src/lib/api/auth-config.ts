import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';
import { ApiError, readApiError } from '$lib/api/errors';
import type { GoogleAllowedDomainsInput, GoogleCredentialsInput } from 'api/schemas';

export type GoogleAuthSettingsView = InferResponseType<
	typeof client.api.settings.auth.google.$get,
	200
>;

export { ApiError as AuthConfigApiError };

export async function getGoogleAuth(): Promise<GoogleAuthSettingsView> {
	const res = await client.api.settings.auth.google.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load Google auth settings');
	return res.json() as Promise<GoogleAuthSettingsView>;
}

export async function saveGoogleCredentials(input: GoogleCredentialsInput): Promise<void> {
	const res = await client.api.settings.auth.google.credentials.$put({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to save Google credentials');
}

export async function saveGoogleAllowedDomains(input: GoogleAllowedDomainsInput): Promise<void> {
	const res = await client.api.settings.auth.google['allowed-domains'].$put({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to save allowed domains');
}

export async function removeGoogleCredentials(): Promise<void> {
	const res = await client.api.settings.auth.google.credentials.$delete();
	if (!res.ok) throw await readApiError(res, 'Failed to remove Google credentials');
}
