import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { ApiKeyRole, CreateApiKeyInput } from 'api/types';

const apiKeys = client.api['api-keys'];

export type ApiKeyView = InferResponseType<typeof apiKeys.$get, 200>[number];

export async function listApiKeys(opts: { role?: ApiKeyRole } = {}): Promise<ApiKeyView[]> {
	const query = opts.role ? { role: opts.role } : {};
	const res = await apiKeys.$get({ query });
	if (!res.ok) throw await readApiError(res, 'Failed to load API keys');
	return res.json() as Promise<ApiKeyView[]>;
}

export async function getApiKey(id: number): Promise<{ token: string }> {
	const res = await apiKeys[':apiKeyId'].$get({ param: { apiKeyId: String(id) } });
	if (!res.ok) throw await readApiError(res, 'Failed to load API key');
	return res.json() as Promise<{ token: string }>;
}

export async function createApiKey(
	input: CreateApiKeyInput
): Promise<{ summary: ApiKeyView; token: string }> {
	const res = await apiKeys.$post({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to create API key');
	return res.json() as Promise<{ summary: ApiKeyView; token: string }>;
}

export async function deleteApiKey(id: number): Promise<void> {
	const res = await apiKeys[':apiKeyId'].$delete({ param: { apiKeyId: String(id) } });
	if (!res.ok) throw await readApiError(res, 'Failed to delete API key');
}
