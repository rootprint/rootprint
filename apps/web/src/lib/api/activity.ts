import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { Window } from '$lib/utils/time-range';

const activity = client.api.admin.activity;
const users = activity.users;
const apiKeys = activity['api-keys'];

export const ACTIVITY_PAGE_SIZE = 50;

export type Summary = InferResponseType<typeof activity.summary.$get, 200>;
export type LatencyBuckets = InferResponseType<typeof activity.latency.$get, 200>;
export type TopActors = InferResponseType<(typeof activity)['top-actors']['$get'], 200>;

export type ActorSummary = InferResponseType<(typeof users)[':userId']['summary']['$get'], 200>;
export type VolumeBuckets = InferResponseType<(typeof users)[':userId']['volume']['$get'], 200>;
export type ActorIndexes = InferResponseType<(typeof users)[':userId']['indexes']['$get'], 200>;
export type RecentResult = InferResponseType<(typeof users)[':userId']['recent']['$get'], 200>;

export async function getSummary(window: Window): Promise<Summary> {
	const res = await activity.summary.$get({ query: { window } });
	if (!res.ok) throw await readApiError(res, 'Failed to load summary');
	return res.json() as Promise<Summary>;
}

export async function getLatency(window: Window): Promise<LatencyBuckets> {
	const res = await activity.latency.$get({ query: { window } });
	if (!res.ok) throw await readApiError(res, 'Failed to load latency');
	return res.json() as Promise<LatencyBuckets>;
}

export async function getTopActors(window: Window, limit = 10): Promise<TopActors> {
	const res = await activity['top-actors'].$get({ query: { window, limit: String(limit) } });
	if (!res.ok) throw await readApiError(res, 'Failed to load top actors');
	return res.json() as Promise<TopActors>;
}

export async function getUserSummary(userId: string, window: Window): Promise<ActorSummary> {
	const res = await users[':userId'].summary.$get({ param: { userId }, query: { window } });
	if (!res.ok) throw await readApiError(res, 'Failed to load user summary');
	return res.json() as Promise<ActorSummary>;
}

export async function getUserVolume(userId: string, window: Window): Promise<VolumeBuckets> {
	const res = await users[':userId'].volume.$get({ param: { userId }, query: { window } });
	if (!res.ok) throw await readApiError(res, 'Failed to load user volume');
	return res.json() as Promise<VolumeBuckets>;
}

export async function getUserLatency(userId: string, window: Window): Promise<LatencyBuckets> {
	const res = await users[':userId'].latency.$get({ param: { userId }, query: { window } });
	if (!res.ok) throw await readApiError(res, 'Failed to load user latency');
	return res.json() as Promise<LatencyBuckets>;
}

export async function getUserIndexes(userId: string, window: Window): Promise<ActorIndexes> {
	const res = await users[':userId'].indexes.$get({ param: { userId }, query: { window } });
	if (!res.ok) throw await readApiError(res, 'Failed to load user indexes');
	return res.json() as Promise<ActorIndexes>;
}

export async function getUserRecent(
	userId: string,
	window: Window,
	opts: { offset?: number; limit?: number } = {}
): Promise<RecentResult> {
	const query: Record<string, string> = { window };
	if (opts.offset !== undefined) query.offset = String(opts.offset);
	if (opts.limit !== undefined) query.limit = String(opts.limit);
	const res = await users[':userId'].recent.$get({ param: { userId }, query });
	if (!res.ok) throw await readApiError(res, 'Failed to load user activity');
	return res.json() as Promise<RecentResult>;
}

export async function getApiKeySummary(id: string, window: Window): Promise<ActorSummary> {
	const res = await apiKeys[':apiKeyId'].summary.$get({
		param: { apiKeyId: id },
		query: { window }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load API key summary');
	return res.json() as Promise<ActorSummary>;
}

export async function getApiKeyVolume(id: string, window: Window): Promise<VolumeBuckets> {
	const res = await apiKeys[':apiKeyId'].volume.$get({
		param: { apiKeyId: id },
		query: { window }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load API key volume');
	return res.json() as Promise<VolumeBuckets>;
}

export async function getApiKeyLatency(id: string, window: Window): Promise<LatencyBuckets> {
	const res = await apiKeys[':apiKeyId'].latency.$get({
		param: { apiKeyId: id },
		query: { window }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load API key latency');
	return res.json() as Promise<LatencyBuckets>;
}

export async function getApiKeyRecent(
	id: string,
	window: Window,
	opts: { offset?: number; limit?: number } = {}
): Promise<RecentResult> {
	const query: Record<string, string> = { window };
	if (opts.offset !== undefined) query.offset = String(opts.offset);
	if (opts.limit !== undefined) query.limit = String(opts.limit);
	const res = await apiKeys[':apiKeyId'].recent.$get({
		param: { apiKeyId: id },
		query
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load API key activity');
	return res.json() as Promise<RecentResult>;
}
