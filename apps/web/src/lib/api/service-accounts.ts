import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';

const serviceAccounts = client.api['service-accounts'];

export type ServiceAccountView = InferResponseType<typeof serviceAccounts.$get, 200>[number];

export async function listServiceAccounts(): Promise<ServiceAccountView[]> {
	const res = await serviceAccounts.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load service accounts');
	return res.json() as Promise<ServiceAccountView[]>;
}

export async function createServiceAccount(name: string): Promise<{ id: string }> {
	const res = await serviceAccounts.$post({ json: { name } });
	if (!res.ok) throw await readApiError(res, 'Failed to create service account');
	return res.json() as Promise<{ id: string }>;
}

export async function deleteServiceAccount(userId: string): Promise<void> {
	const res = await serviceAccounts[':userId'].$delete({ param: { userId } });
	if (!res.ok) throw await readApiError(res, 'Failed to delete service account');
}
