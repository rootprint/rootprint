import type { InferResponseType } from 'hono/client';
import type { ActivityQueryInput as ActivityQuery } from 'api/schemas';
import { client } from '#lib/api/client.js';
import { readApiError } from '#lib/api/errors.js';

const activity = client.api.admin.activity;

export const ACTIVITY_PAGE_SIZE = 50;

export type Summary = InferResponseType<typeof activity.summary.$get, 200>;
export type LatencyBuckets = InferResponseType<typeof activity.latency.$get, 200>;
export type ActorIndexes = InferResponseType<typeof activity.indexes.$get, 200>;
export type TopActors = InferResponseType<(typeof activity)['top-actors']['$get'], 200>;
export type RecentResult = InferResponseType<typeof activity.recent.$get, 200>;

export async function getSummary(query: ActivityQuery): Promise<Summary> {
	const res = await activity.summary.$get({ query });
	if (!res.ok) throw await readApiError(res, 'Failed to load summary');
	return res.json();
}

export async function getLatency(query: ActivityQuery): Promise<LatencyBuckets> {
	const res = await activity.latency.$get({ query });
	if (!res.ok) throw await readApiError(res, 'Failed to load latency');
	return res.json();
}

export async function getIndexUsage(query: ActivityQuery): Promise<ActorIndexes> {
	const res = await activity.indexes.$get({ query });
	if (!res.ok) throw await readApiError(res, 'Failed to load index usage');
	return res.json();
}

export async function getTopActors(query: ActivityQuery): Promise<TopActors> {
	const res = await activity['top-actors'].$get({ query });
	if (!res.ok) throw await readApiError(res, 'Failed to load top actors');
	return res.json();
}

export async function getRecent(query: ActivityQuery, offset: number): Promise<RecentResult> {
	const res = await activity.recent.$get({
		query: { ...query, offset: String(offset), limit: String(ACTIVITY_PAGE_SIZE) }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load recent activity');
	return res.json();
}
