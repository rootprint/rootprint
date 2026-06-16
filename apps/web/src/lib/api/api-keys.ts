import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { CreateApiKeyInput } from 'api/types';

const apiKeys = client.api['api-keys'];
const serviceAccountApiKeys = apiKeys['service-account'];

export type ApiKeyView = InferResponseType<typeof apiKeys.$get, 200>[number];
export type ServiceAccountKeyView = InferResponseType<
	typeof serviceAccountApiKeys.$get,
	200
>[number];

export async function listApiKeys(): Promise<ApiKeyView[]> {
	const res = await apiKeys.$get();
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

export async function listServiceAccountKeys(): Promise<ServiceAccountKeyView[]> {
	const res = await serviceAccountApiKeys.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load service account keys');
	return res.json() as Promise<ServiceAccountKeyView[]>;
}

export async function createServiceAccountKey(input: {
	name: string;
	userId: string;
}): Promise<{ id: string; token: string }> {
	const res = await serviceAccountApiKeys.$post({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to create service account key');
	return res.json() as Promise<{ id: string; token: string }>;
}

export async function deleteServiceAccountKey(id: string): Promise<void> {
	const res = await serviceAccountApiKeys[':id'].$delete({ param: { id } });
	if (!res.ok) throw await readApiError(res, 'Failed to revoke service account key');
}
