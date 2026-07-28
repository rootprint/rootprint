import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { TraceResponse } from 'api/types';

export async function fetchTrace(
	traceId: string,
	opts: { signal?: AbortSignal } = {}
): Promise<TraceResponse> {
	const res = await client.api.traces[':traceId'].$get(
		{ param: { traceId } },
		{ init: { signal: opts.signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Failed to load trace');

	return (await res.json()) as TraceResponse;
}
