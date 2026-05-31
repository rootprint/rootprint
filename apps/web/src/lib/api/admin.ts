import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';

export type ClusterOverview = InferResponseType<typeof client.api.admin.cluster.$get, 200>;
export type AdminMetrics = InferResponseType<typeof client.api.admin.metrics.$get, 200>;

export async function getClusterOverview(): Promise<ClusterOverview> {
	const res = await client.api.admin.cluster.$get();
	if (!res.ok) throw new Error(`Failed to load cluster overview (HTTP ${res.status})`);
	return res.json() as Promise<ClusterOverview>;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
	const res = await client.api.admin.metrics.$get();
	if (!res.ok) throw new Error(`Failed to load metrics (HTTP ${res.status})`);
	return res.json() as Promise<AdminMetrics>;
}

/** Returns plain-text Prometheus exposition format from `/api/admin/metrics/raw`. */
export async function getAdminMetricsRaw(): Promise<string> {
	const res = await client.api.admin.metrics.raw.$get();
	if (!res.ok) throw new Error(`Failed to load raw metrics (HTTP ${res.status})`);
	return res.text();
}
