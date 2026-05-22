import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';
import type { ApiErrorBody } from 'api/types';
import type { GoogleAllowedDomainsInput, GoogleCredentialsInput } from 'api/schemas';

export type GoogleAuthSettingsView = InferResponseType<typeof client.api.settings.auth.google.$get, 200>;

export class AuthConfigApiError extends Error {
  body?: ApiErrorBody;
  constructor(message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'AuthConfigApiError';
    this.body = body;
  }
}

async function readApiError(res: Response, fallback: string): Promise<AuthConfigApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new AuthConfigApiError(
    body?.error.message ?? `${fallback} (${res.status})`,
    body ?? undefined
  );
}

export async function getGoogleAuth(): Promise<GoogleAuthSettingsView> {
  const res = await client.api.settings.auth.google.$get();
  if (!res.ok) throw await readApiError(res, 'Failed to load Google auth settings');
  return res.json() as Promise<GoogleAuthSettingsView>;
}

export async function saveGoogleCredentials(input: GoogleCredentialsInput): Promise<void> {
  const res = await client.api.settings.auth.google.credentials.$put({ json: input });
  if (!res.ok) throw await readApiError(res, 'Failed to save Google credentials');
}

export async function saveGoogleAllowedDomains(
  input: GoogleAllowedDomainsInput
): Promise<void> {
  const res = await client.api.settings.auth.google['allowed-domains'].$put({ json: input });
  if (!res.ok) throw await readApiError(res, 'Failed to save allowed domains');
}

export async function removeGoogleCredentials(): Promise<void> {
  const res = await client.api.settings.auth.google.credentials.$delete();
  if (!res.ok) throw await readApiError(res, 'Failed to remove Google credentials');
}
