import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { TraceResponse } from 'api/types';

export async function fetchTrace(
	indexId: string,
	traceId: string,
	opts: { signal?: AbortSignal } = {}
): Promise<TraceResponse> {
	const res = await client.api.indexes[':indexId'].traces[':traceId'].$get(
		{ param: { indexId, traceId } },
		{ init: { signal: opts.signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Failed to load trace');

	return (await res.json()) as TraceResponse;
}
