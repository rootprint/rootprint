import * as v from 'valibot';

import { INDEX_VISIBILITIES } from '../../constants.js';
import { named } from '../../lib/openapi/describe.js';
import { isoTimestampString } from '../../utils/valibot.js';

// ---- Activity ----

const percentiles = {
	p50: v.nullable(v.number()),
	p95: v.nullable(v.number()),
	p99: v.nullable(v.number())
};

const summaryRowEntries = {
	totalSearches: v.number(),
	errorCount: v.number(),
	...percentiles
};

export const SummaryRowResponse = named('SummaryRowResponse', v.object(summaryRowEntries));

export const ActorSummaryRowResponse = named(
	'ActorSummaryRowResponse',
	v.object({
		...summaryRowEntries,
		displayName: v.nullable(v.string()),
		email: v.nullable(v.string())
	})
);

export const LatencyBucketResponse = named(
	'LatencyBucketResponse',
	v.object({ t: v.string(), count: v.number(), ...percentiles })
);

export const LatencyBucketsResponse = v.array(LatencyBucketResponse);

export const VolumeBucketResponse = named(
	'VolumeBucketResponse',
	v.object({ t: v.string(), count: v.number() })
);

export const VolumeBucketsResponse = v.array(VolumeBucketResponse);

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

export const ActorIndexRowResponse = named(
	'ActorIndexRowResponse',
	v.object({
		indexId: v.string(),
		count: v.number(),
		avgDurationMs: v.number(),
		errorCount: v.number()
	})
);

export const ActorIndexesResponse = v.array(ActorIndexRowResponse);

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
		memoryRssBytes: v.nullable(v.number()),
		fdsOpen: v.nullable(v.number()),
		fdsMax: v.nullable(v.number()),
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
		uptimeSeconds: v.nullable(v.number()),
		resources: ResourceSnapshotResponse,
		saturation: SaturationSnapshotResponse
	})
);

// ---- Cluster overview ----

export const ClusterHealthResponse = named(
	'ClusterHealthResponse',
	v.object({ healthy: v.boolean(), endpoint: v.string() })
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
		visibility: v.picklist(INDEX_VISIBILITIES),
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
