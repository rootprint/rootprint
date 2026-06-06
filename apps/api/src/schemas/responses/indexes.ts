import * as v from 'valibot';

import { INDEX_VISIBILITIES } from '../../constants.js';
import { named } from '../../lib/openapi/describe.js';

export const IndexFieldSchema = named(
	'IndexFieldSchema',
	v.object({
		name: v.string(),
		type: v.string(),
		fast: v.nullable(v.boolean())
	})
);

export const IndexSourceSchema = named(
	'IndexSourceSchema',
	v.object({
		sourceId: v.string(),
		sourceType: v.string(),
		enabled: v.boolean()
	})
);

export const SourceDetailSchema = named(
	'SourceDetailSchema',
	v.object({
		sourceId: v.string(),
		sourceType: v.string(),
		enabled: v.boolean(),
		inputFormat: v.nullable(v.string()),
		numPipelines: v.nullable(v.number()),
		streamName: v.nullable(v.string()),
		region: v.nullable(v.string()),
		endpoint: v.nullable(v.string()),
		queueUrl: v.nullable(v.string()),
		messageType: v.nullable(v.string()),
		vrlScript: v.nullable(v.string()),
		hasUnsupportedConfig: v.boolean()
	})
);

export const PreferencesResponse = named(
	'PreferencesResponse',
	v.object({
		displayFields: v.nullable(v.array(v.string())),
		lineWrap: v.boolean(),
		displayMode: v.picklist(['table', 'inline'])
	})
);

export const IndexSummarySchema = named(
	'IndexSummarySchema',
	v.object({
		indexId: v.string(),
		displayName: v.nullable(v.string()),
		visibility: v.picklist(INDEX_VISIBILITIES),
		fieldCount: v.number(),
		sourceCount: v.number(),
		mode: v.nullable(v.string()),
		createTimestamp: v.nullable(v.number())
	})
);

export const IndexListResponse = v.array(IndexSummarySchema);

export const IndexDetailResponse = named(
	'IndexDetailResponse',
	v.object({
		indexId: v.string(),
		displayName: v.nullable(v.string()),
		visibility: v.picklist(INDEX_VISIBILITIES),
		levelField: v.string(),
		messageField: v.string(),
		tracebackField: v.nullable(v.string()),
		contextFields: v.nullable(v.array(v.string())),
		indexUri: v.nullable(v.string()),
		timestampField: v.nullable(v.string()),
		mode: v.nullable(v.string()),
		tagFields: v.nullable(v.array(v.string())),
		defaultSearchFields: v.nullable(v.array(v.string())),
		storeSource: v.nullable(v.boolean()),
		fields: v.array(IndexFieldSchema),
		sources: v.array(IndexSourceSchema)
	})
);

export const IndexViewConfigResponse = named(
	'IndexViewConfigResponse',
	v.object({
		indexId: v.string(),
		displayName: v.nullable(v.string()),
		levelField: v.string(),
		messageField: v.string(),
		tracebackField: v.nullable(v.string()),
		contextFields: v.nullable(v.array(v.string())),
		timestampField: v.string(),
		isOtel: v.boolean()
	})
);

export const IndexFieldsResponse = named(
	'IndexFieldsResponse',
	v.object({ fields: v.array(IndexFieldSchema) })
);

export const IndexStatsPointSchema = named(
	'IndexStatsPointSchema',
	v.object({
		capturedAt: v.date(),
		numDocs: v.number(),
		sizeBytes: v.number(),
		uncompressedBytes: v.number(),
		numSplits: v.number(),
		minTimestamp: v.nullable(v.number()),
		maxTimestamp: v.nullable(v.number())
	})
);

export const IndexStatsResponse = named(
	'IndexStatsResponse',
	v.object({ indexId: v.string(), points: v.array(IndexStatsPointSchema) })
);

// hits are opaque Quickwit passthrough payloads.
export const LogSearchResponse = named(
	'LogSearchResponse',
	v.object({
		hits: v.array(v.record(v.string(), v.unknown())),
		numHits: v.number(),
		elapsedTimeMicros: v.number()
	})
);

export const HistogramBucketSchema = named(
	'HistogramBucketSchema',
	v.object({
		key: v.number(),
		keyAsString: v.string(),
		docCount: v.number(),
		levels: v.record(v.string(), v.number())
	})
);

export const HistogramResponse = named(
	'HistogramResponse',
	v.object({ buckets: v.array(HistogramBucketSchema) })
);

export const FieldValueEntrySchema = named(
	'FieldValueEntrySchema',
	v.object({ value: v.string(), count: v.number() })
);

export const FieldValuesResponse = named(
	'FieldValuesResponse',
	v.object({ values: v.array(FieldValueEntrySchema) })
);

export const FieldValuesBulkResponse = named(
	'FieldValuesBulkResponse',
	v.object({
		values: v.record(v.string(), v.array(FieldValueEntrySchema)),
		elapsedTimeMicros: v.optional(v.number())
	})
);
