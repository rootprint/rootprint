import * as v from 'valibot';

import { SPAN_KINDS } from '../../constants.js';
import { named } from '../../lib/openapi/describe.js';

export const ServiceHealthBucketSchema = named(
	'ServiceHealthBucket',
	v.object({
		keyMs: v.number(),
		requests: v.number(),
		errors: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number()),
		avg: v.nullable(v.number())
	})
);

export const ServiceHealthEndpointSchema = named(
	'ServiceHealthEndpoint',
	v.object({
		/** Unique across the whole list — service included — so clients can key rows on it alone. */
		id: v.string(),
		service: v.string(),
		name: v.string(),
		routeAvailable: v.boolean(),
		/** Raw span name, for the trace explorer's `operation` filter. */
		operation: v.string(),
		/** Quickwit clause for exactly the spans this row counts, beyond its service and operation. */
		query: v.string(),
		requests: v.number(),
		errors: v.number(),
		totalMillis: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const ServiceHealthServiceRowSchema = named(
	'ServiceHealthServiceRow',
	v.object({
		name: v.string(),
		requests: v.number(),
		errors: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const ServiceHealthFailingOperationSchema = named(
	'ServiceHealthFailingOperation',
	v.object({
		name: v.string(),
		errors: v.number()
	})
);

export const ServiceErrorRowSchema = named(
	'ServiceErrorRow',
	v.object({
		traceId: v.string(),
		spanId: v.string(),
		timestampMs: v.number(),
		service: v.string(),
		operation: v.string(),
		kind: v.picklist(SPAN_KINDS),
		/** Empty when the span carried neither a status message nor an exception event. */
		message: v.string(),
		httpStatus: v.nullable(v.number()),
		durationMillis: v.number()
	})
);

export const ServiceHealthDependencySchema = named(
	'ServiceHealthDependency',
	v.object({
		name: v.string(),
		peers: v.array(v.string()),
		calls: v.number(),
		totalMillis: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const ServiceLatencySchema = named(
	'ServiceLatency',
	v.object({
		name: v.string(),
		/** One entry per `latencyKeysMs` timestamp. */
		p95: v.array(v.nullable(v.number()))
	})
);

export const ServiceHealthSummarySchema = named(
	'ServiceHealthSummary',
	v.object({
		requests: v.number(),
		errors: v.number(),
		errorSpans: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const ServiceErrorsResponseSchema = named(
	'ServiceErrorsResponse',
	v.object({
		rows: v.array(ServiceErrorRowSchema),
		/** True when the raw hit count (before dropping rows with no ids) equals the requested limit. */
		hasMore: v.boolean()
	})
);

export const ServiceHealthResponseSchema = named(
	'ServiceHealthResponse',
	v.object({
		telemetryStatus: v.picklist(['available', 'span_store_missing']),
		services: v.array(ServiceHealthServiceRowSchema),
		serviceNames: v.array(v.string()),
		servicesTruncated: v.boolean(),
		intervalSeconds: v.number(),
		summary: ServiceHealthSummarySchema,
		buckets: v.array(ServiceHealthBucketSchema),
		/** Shared histogram grid for every entry in `serviceLatencies`. */
		latencyKeysMs: v.array(v.number()),
		serviceLatencies: v.array(ServiceLatencySchema),
		endpoints: v.array(ServiceHealthEndpointSchema),
		failingOperations: v.array(ServiceHealthFailingOperationSchema),
		dependencies: v.array(ServiceHealthDependencySchema)
	})
);

export type ServiceHealthBucket = v.InferOutput<typeof ServiceHealthBucketSchema>;

export type ServiceHealthEndpoint = v.InferOutput<typeof ServiceHealthEndpointSchema>;

export type ServiceLatency = v.InferOutput<typeof ServiceLatencySchema>;

export type ServiceHealthServiceRow = v.InferOutput<typeof ServiceHealthServiceRowSchema>;

export type ServiceHealthFailingOperation = v.InferOutput<
	typeof ServiceHealthFailingOperationSchema
>;

export type ServiceErrorRow = v.InferOutput<typeof ServiceErrorRowSchema>;

export type ServiceHealthDependency = v.InferOutput<typeof ServiceHealthDependencySchema>;

export type ServiceHealthResponse = v.InferOutput<typeof ServiceHealthResponseSchema>;

export type ServiceErrorsResponse = v.InferOutput<typeof ServiceErrorsResponseSchema>;
