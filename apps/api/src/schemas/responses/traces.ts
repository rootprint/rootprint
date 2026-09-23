import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

const TraceAttributesSchema = v.record(v.string(), v.string());

export const SpanEventSchema = named(
	'SpanEvent',
	v.object({
		name: v.string(),
		timeOffsetMicros: v.number(),
		fields: TraceAttributesSchema
	})
);

export const TraceSpanSchema = named(
	'TraceSpan',
	v.object({
		spanId: v.string(),
		parentSpanId: v.nullable(v.string()),
		name: v.string(),
		serviceName: v.string(),
		startOffsetMicros: v.number(),
		durationMicros: v.number(),
		isError: v.boolean(),
		attributes: TraceAttributesSchema,
		resourceId: v.string(),
		events: v.array(SpanEventSchema)
	})
);

export const TraceResponseSchema = named(
	'TraceResponse',
	v.object({
		spans: v.array(TraceSpanSchema),
		traceStartMicros: v.number(),
		resources: v.record(v.string(), TraceAttributesSchema),
		truncated: v.pipe(
			v.boolean(),
			v.metadata({
				description:
					'The trace has more span documents than one request returns, or contained documents missing a required field, so some spans are absent. The displayed trace is incomplete.'
			})
		)
	})
);

export const ExploreSpanRowSchema = named(
	'ExploreSpanRow',
	v.object({
		traceId: v.string(),
		spanId: v.string(),
		service: v.string(),
		operation: v.string(),
		startMs: v.number(),
		durationMicros: v.number(),
		isError: v.boolean(),
		httpStatus: v.nullable(v.number())
	})
);

export const ExploreSpansResponseSchema = named(
	'ExploreSpansResponse',
	v.object({ rows: v.array(ExploreSpanRowSchema), total: v.number() })
);

const latencyPercentiles = {
	p50: v.nullable(v.number()),
	p95: v.nullable(v.number()),
	p99: v.nullable(v.number())
};

export const ExploreBucketSchema = named(
	'ExploreBucket',
	v.object({ keyMs: v.number(), requests: v.number(), errors: v.number(), ...latencyPercentiles })
);

export const ExploreSummarySchema = named(
	'ExploreSummary',
	v.object({ requests: v.number(), errors: v.number(), ...latencyPercentiles })
);

export const ExploreOperationSchema = named(
	'ExploreOperation',
	v.object({
		operation: v.string(),
		services: v.array(v.string()),
		requests: v.number(),
		ratePerSec: v.number(),
		errors: v.number(),
		...latencyPercentiles,
		/** Request counts on one grid shared by every operation in the response. */
		spark: v.array(v.number())
	})
);

export const ExploreOverviewResponseSchema = named(
	'ExploreOverviewResponse',
	v.object({
		buckets: v.array(ExploreBucketSchema),
		summary: ExploreSummarySchema,
		operations: v.array(ExploreOperationSchema),
		operationsTruncated: v.boolean(),
		/** Ignores the service and operation filters, so the picker keeps every choice. */
		facets: v.object({ services: v.array(v.string()) })
	})
);
