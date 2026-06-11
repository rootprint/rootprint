import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type {
	GoogleAllowedDomainsInput,
	GoogleCredentialsInput,
	GitHubAllowedOrgsInput,
	GitHubCredentialsInput
} from 'api/schemas';

export type GoogleAuthSettingsView = InferResponseType<
	typeof client.api.settings.auth.google.$get,
	200
>;

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

export type GitHubAuthSettingsView = InferResponseType<
	typeof client.api.settings.auth.github.$get,
	200
>;

export async function getGitHubAuth(): Promise<GitHubAuthSettingsView> {
	const res = await client.api.settings.auth.github.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load GitHub auth settings');
	return res.json() as Promise<GitHubAuthSettingsView>;
}

export async function saveGitHubCredentials(input: GitHubCredentialsInput): Promise<void> {
	const res = await client.api.settings.auth.github.credentials.$put({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to save GitHub credentials');
}

export async function saveGitHubAllowedOrgs(input: GitHubAllowedOrgsInput): Promise<void> {
	const res = await client.api.settings.auth.github['allowed-orgs'].$put({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to save allowed organizations');
}

export async function removeGitHubCredentials(): Promise<void> {
	const res = await client.api.settings.auth.github.credentials.$delete();
	if (!res.ok) throw await readApiError(res, 'Failed to remove GitHub credentials');
}
