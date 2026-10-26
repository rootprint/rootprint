import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';
import { isoTimestampString } from '../../utils/valibot.js';

// ---- Activity ----

const percentiles = {
	p50: v.nullable(v.number()),
	p95: v.nullable(v.number()),
	p99: v.nullable(v.number())
};

export const SummaryRowResponse = named(
	'SummaryRowResponse',
	v.object({
		totalSearches: v.number(),
		errorCount: v.number(),
		...percentiles,
		// Name of the API key the activity is scoped to.
		displayName: v.nullable(v.string())
	})
);

export const LatencyBucketResponse = named(
	'LatencyBucketResponse',
	v.object({ t: v.string(), count: v.number(), ...percentiles })
);

export const LatencyBucketsResponse = v.array(LatencyBucketResponse);

export const TopActorRowResponse = named(
	'TopActorRowResponse',
	v.object({
		kind: v.picklist(['user', 'apiKey']),
		id: v.string(),
		label: v.nullable(v.string()),
		count: v.number(),
		avgDurationMs: v.number(),
		errorCount: v.number(),
		indexes: v.array(v.string())
	})
);

export const TopActorsResponse = v.array(TopActorRowResponse);

export const IndexUsageRowResponse = named(
	'IndexUsageRowResponse',
	v.object({
		indexId: v.string(),
		count: v.number(),
		avgDurationMs: v.number(),
		errorCount: v.number()
	})
);

export const IndexUsageResponse = v.array(IndexUsageRowResponse);

export const RecentRowResponse = named(
	'RecentRowResponse',
	v.object({
		id: v.number(),
		executedAt: v.string(),
		indexId: v.string(),
		durationMs: v.number(),
		numHits: v.nullable(v.number()),
		query: v.string(),
		startTs: v.nullable(v.number()),
		endTs: v.nullable(v.number())
	})
);

export const RecentResultResponse = named(
	'RecentResultResponse',
	v.object({ total: v.number(), rows: v.array(RecentRowResponse) })
);

// ---- Metrics (Quickwit Prometheus snapshot) ----

export const QuickwitBuildInfoResponse = named(
	'QuickwitBuildInfoResponse',
	v.object({
		version: v.nullable(v.string()),
		commitHash: v.nullable(v.string()),
		buildDate: v.nullable(v.string())
	})
);

export const ResourceSnapshotResponse = named(
	'ResourceSnapshotResponse',
	v.object({
		memoryResidentBytes: v.nullable(v.number()),
		walDiskBytes: v.nullable(v.number())
	})
);

export const SaturationSnapshotResponse = named(
	'SaturationSnapshotResponse',
	v.object({ cpuBusyRatio: v.nullable(v.number()) })
);

export const QuickwitSnapshotResponse = named(
	'QuickwitSnapshotResponse',
	v.object({
		fetchedAt: v.string(),
		build: QuickwitBuildInfoResponse,
		resources: ResourceSnapshotResponse,
		saturation: SaturationSnapshotResponse
	})
);

// ---- Cluster overview ----

export const ClusterHealthResponse = named(
	'ClusterHealthResponse',
	v.object({
		healthy: v.boolean(),
		endpoint: v.string(),
		clusterId: v.nullable(v.string()),
		readyNodes: v.nullable(v.number()),
		liveNodes: v.nullable(v.number()),
		deadNodes: v.nullable(v.number())
	})
);

export const ClusterTotalsResponse = named(
	'ClusterTotalsResponse',
	v.object({
		indexCount: v.number(),
		totalDocs: v.number(),
		totalSizeBytes: v.number(),
		totalSplits: v.number(),
		latestCapturedAt: v.nullable(v.string())
	})
);

export const PerIndexOverviewResponse = named(
	'PerIndexOverviewResponse',
	v.object({
		indexId: v.string(),
		displayName: v.nullable(v.string()),
		numDocs: v.nullable(v.number()),
		sizeBytes: v.nullable(v.number()),
		uncompressedBytes: v.nullable(v.number()),
		numSplits: v.nullable(v.number()),
		capturedAt: v.nullable(isoTimestampString)
	})
);

export const ClusterOverviewResponse = named(
	'ClusterOverviewResponse',
	v.object({
		health: ClusterHealthResponse,
		totals: ClusterTotalsResponse,
		perIndex: v.array(PerIndexOverviewResponse)
	})
);

export const ClusterDocumentStatusResponse = named(
	'ClusterDocumentStatusResponse',
	v.object({ hasDocuments: v.boolean() })
);

export type ClusterOverview = v.InferOutput<typeof ClusterOverviewResponse>;

export type QuickwitBuildInfo = v.InferOutput<typeof QuickwitBuildInfoResponse>;

export type ResourceSnapshot = v.InferOutput<typeof ResourceSnapshotResponse>;

// cpuBusyRatio is max(main, non_blocking) tokio worker busy ratio — Quickwit
// computes this over a recent window, so it's a real "right now" % rather than
// cumulative.
export type SaturationSnapshot = v.InferOutput<typeof SaturationSnapshotResponse>;

export type QuickwitSnapshot = v.InferOutput<typeof QuickwitSnapshotResponse>;

export type SummaryRow = v.InferOutput<typeof SummaryRowResponse>;

export type LatencyBucket = v.InferOutput<typeof LatencyBucketResponse>;

export type TopActorRow = v.InferOutput<typeof TopActorRowResponse>;

export type IndexUsageRow = v.InferOutput<typeof IndexUsageRowResponse>;

export type RecentResult = v.InferOutput<typeof RecentResultResponse>;
