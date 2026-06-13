import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { Filter } from '$lib/types';

export type ShareView = InferResponseType<(typeof client.api.shares)[':code']['$get'], 200>;

export interface CreateShareInput {
	indexId: string;
	query: string;
	/** Seconds-since-epoch. */
	startTime: number;
	/** Seconds-since-epoch. */
	endTime: number;
	hit: Record<string, unknown>;
	filters: Filter[];
}

export async function createShare(input: CreateShareInput): Promise<{ code: string }> {
	const res = await client.api.shares.$post({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to create share link');
	return res.json();
}

export async function getShare(code: string): Promise<ShareView> {
	const res = await client.api.shares[':code'].$get({ param: { code } });
	if (!res.ok) throw await readApiError(res, 'Failed to load share');
	return res.json();
}
