import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';

export type ClusterOverview = InferResponseType<typeof client.api.admin.cluster.$get, 200>;
export type ClusterDocumentStatus = InferResponseType<
	(typeof client.api.admin.cluster)['document-status']['$get'],
	200
>;
export type AdminMetrics = InferResponseType<typeof client.api.admin.metrics.$get, 200>;

export async function getClusterOverview(): Promise<ClusterOverview> {
	const res = await client.api.admin.cluster.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load cluster overview');
	return res.json() as Promise<ClusterOverview>;
}

export async function getClusterDocumentStatus(): Promise<ClusterDocumentStatus> {
	const res = await client.api.admin.cluster['document-status'].$get();
	if (!res.ok) throw await readApiError(res, 'Failed to check cluster document status');
	return res.json() as Promise<ClusterDocumentStatus>;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
	const res = await client.api.admin.metrics.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load metrics');
	return res.json() as Promise<AdminMetrics>;
}

/** Returns plain-text Prometheus exposition format from `/api/admin/metrics/raw`. */
export async function getAdminMetricsRaw(): Promise<string> {
	const res = await client.api.admin.metrics.raw.$get();
	if (!res.ok) throw await readApiError(res, 'Failed to load raw metrics');
	return res.text();
}
