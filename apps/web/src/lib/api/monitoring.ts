import type { ERROR_HTTP_STATUSES } from 'api/constants';
import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import { computeHistogramIntervalSeconds, formatInterval } from '$lib/utils/histogram';

const monitoring = client.api.monitoring;

export type ServiceHealth = InferResponseType<typeof monitoring.services.$get, 200>;
export type ServiceHealthBucket = ServiceHealth['buckets'][number];
export type ServiceHealthSummary = ServiceHealth['summary'];
export type ServiceHealthEndpoint = ServiceHealth['endpoints'][number];
export type ServiceLatency = ServiceHealth['serviceLatencies'][number];
export type ServiceHealthServiceRow = ServiceHealth['services'][number];
export type ServiceHealthFailingOperation = ServiceHealth['failingOperations'][number];
export type ServiceHealthDependency = ServiceHealth['dependencies'][number];

export async function getServiceHealth(input: {
	service: string | null;
	startTs: number;
	endTs: number;
	endpointLimit: number;
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

export type ServiceErrors = InferResponseType<typeof monitoring.errors.$get, 200>;
export type ServiceErrorRow = ServiceErrors['rows'][number];
export type ServiceErrorKind = ServiceErrorRow['kind'];
export type ServiceErrorHttpStatus = (typeof ERROR_HTTP_STATUSES)[number];

export async function getServiceErrors(input: {
	service: string | null;
	startTs: number;
	endTs: number;
	operation: string | null;
	kind: ServiceErrorKind | null;
	httpStatus: ServiceErrorHttpStatus | null;
	limit: number;
	offset: number;
	signal?: AbortSignal;
}): Promise<ServiceErrors> {
	const res = await monitoring.errors.$get(
		{
			query: {
				service: input.service ?? undefined,
				startTs: String(input.startTs),
				endTs: String(input.endTs),
				operation: input.operation ?? undefined,
				kind: input.kind ?? undefined,
				httpStatus: input.httpStatus ?? undefined,
				limit: String(input.limit),
				offset: String(input.offset)
			}
		},
		{ init: { signal: input.signal } }
	);
	if (!res.ok) throw await readApiError(res, 'Failed to load errors');
	return res.json();
}
