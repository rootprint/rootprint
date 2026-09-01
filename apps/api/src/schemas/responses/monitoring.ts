import * as v from 'valibot';

import { SPAN_KINDS } from '../../constants.js';
import { named } from '../../lib/openapi/describe.js';

export const MonitoringBucketSchema = named(
	'MonitoringBucket',
	v.object({
		keyMs: v.number(),
		requests: v.number(),
		errors: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number()),
		avg: v.nullable(v.number())
	})
);

export const MonitoringEndpointSchema = named(
	'MonitoringEndpoint',
	v.object({
		/** Unique across the whole list — service included — so clients can key rows on it alone. */
		id: v.string(),
		service: v.string(),
		name: v.string(),
		routeAvailable: v.boolean(),
		requests: v.number(),
		totalMillis: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const MonitoringServiceRowSchema = named(
	'MonitoringServiceRow',
	v.object({
		name: v.string(),
		requests: v.number(),
		errors: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const MonitoringFailingOperationSchema = named(
	'MonitoringFailingOperation',
	v.object({
		name: v.string(),
		errors: v.number()
	})
);

export const MonitoringErrorRowSchema = named(
	'MonitoringErrorRow',
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

export const MonitoringDependencySchema = named(
	'MonitoringDependency',
	v.object({
		name: v.string(),
		peers: v.array(v.string()),
		calls: v.number(),
		totalMillis: v.number(),
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const MonitoringServiceLatencySchema = named(
	'MonitoringServiceLatency',
	v.object({
		name: v.string(),
		/** One entry per `latencyKeysMs` timestamp. */
		p95: v.array(v.nullable(v.number()))
	})
);

export const MonitoringSummarySchema = named(
	'MonitoringSummary',
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
		rows: v.array(MonitoringErrorRowSchema),
		/** True when the raw hit count (before dropping rows with no ids) equals the requested limit. */
		hasMore: v.boolean()
	})
);

export const ServiceHealthResponseSchema = named(
	'ServiceHealthResponse',
	v.object({
		telemetryStatus: v.picklist(['available', 'span_store_missing']),
		services: v.array(MonitoringServiceRowSchema),
		serviceNames: v.array(v.string()),
		servicesTruncated: v.boolean(),
		intervalSeconds: v.number(),
		summary: MonitoringSummarySchema,
		buckets: v.array(MonitoringBucketSchema),
		/** Shared histogram grid for every entry in `serviceLatencies`. */
		latencyKeysMs: v.array(v.number()),
		serviceLatencies: v.array(MonitoringServiceLatencySchema),
		endpoints: v.array(MonitoringEndpointSchema),
		failingOperations: v.array(MonitoringFailingOperationSchema),
		dependencies: v.array(MonitoringDependencySchema)
	})
);
