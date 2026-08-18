import * as v from 'valibot';

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
		p50: v.nullable(v.number()),
		p95: v.nullable(v.number())
	})
);

export const ServiceHealthResponseSchema = named(
	'ServiceHealthResponse',
	v.object({
		telemetryStatus: v.picklist(['available', 'span_store_missing']),
		services: v.array(v.string()),
		servicesTruncated: v.boolean(),
		intervalSeconds: v.number(),
		summary: MonitoringSummarySchema,
		buckets: v.array(MonitoringBucketSchema),
		/** Shared histogram grid for every entry in `serviceLatencies`. */
		latencyKeysMs: v.array(v.number()),
		serviceLatencies: v.array(MonitoringServiceLatencySchema),
		endpoints: v.array(MonitoringEndpointSchema)
	})
);
