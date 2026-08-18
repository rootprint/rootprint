import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import { computeHistogramIntervalSeconds, formatInterval } from '$lib/utils/histogram';

const monitoring = client.api.monitoring;

export type ServiceHealth = InferResponseType<typeof monitoring.services.$get, 200>;
export type ServiceHealthBucket = ServiceHealth['buckets'][number];
export type ServiceLatency = ServiceHealth['serviceLatencies'][number];

export async function getServiceHealth(input: {
	service: string | null;
	startTs: number;
	endTs: number;
	endpointLimit: 10 | 20 | 30;
}): Promise<ServiceHealth> {
	const res = await monitoring.services.$get({
		query: {
			service: input.service ?? undefined,
			startTs: String(input.startTs),
			endTs: String(input.endTs),
			interval: formatInterval(computeHistogramIntervalSeconds(input.endTs - input.startTs)),
			endpointLimit: String(input.endpointLimit)
		}
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load service health');
	return res.json();
}
