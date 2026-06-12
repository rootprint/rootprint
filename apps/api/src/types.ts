import type * as v from 'valibot';
import type { INDEX_VISIBILITIES, INDEX_VIEWS } from './constants.js';
import type {
	FieldValueEntrySchema,
	FieldValuesBulkResponse as FieldValuesBulkResponseSchema,
	FieldValuesResponse as FieldValuesResponseSchema,
	HistogramBucketSchema,
	HistogramResponse as HistogramResponseSchema,
	IndexDetailResponse as IndexDetailResponseSchema,
	IndexFieldSchema,
	IndexListResponse as IndexListResponseSchema,
	IndexStatsPointSchema,
	IndexViewConfigResponse as IndexViewConfigResponseSchema,
	LogSearchResponse as LogSearchResponseSchema,
	PreferencesResponse as PreferencesResponseSchema,
	SourceDetailSchema as SourceDetailResponseSchema
} from './schemas/responses/indexes.js';
import type { SavedViewResponse as SavedViewResponseSchema } from './schemas/responses/views.js';
import type {
	ApiKeyResponse as ApiKeyResponseSchema,
	ApiKeyValueResponse as ApiKeyValueResponseSchema,
	PersonalApiKeyResponse as PersonalApiKeyResponseSchema
} from './schemas/responses/api-keys.js';
import type {
	UserResponse as UserResponseSchema,
	InviteUrlResponse as InviteUrlResponseSchema
} from './schemas/responses/users.js';
import type { AuthProvidersResponse as AuthProvidersResponseSchema } from './schemas/responses/auth.js';
import type { HealthResponse as HealthResponseSchema } from './schemas/responses/health.js';
import type { ShareViewResponse as ShareViewResponseSchema } from './schemas/responses/shares.js';
import type {
	GoogleAuthSettingsResponse as GoogleAuthSettingsResponseSchema,
	GitHubAuthSettingsResponse as GitHubAuthSettingsResponseSchema
} from './schemas/responses/settings.js';
import type {
	ActorIndexRowResponse as ActorIndexRowResponseSchema,
	ActorSummaryRowResponse as ActorSummaryRowResponseSchema,
	ClusterHealthResponse as ClusterHealthResponseSchema,
	ClusterOverviewResponse as ClusterOverviewResponseSchema,
	ClusterTotalsResponse as ClusterTotalsResponseSchema,
	LatencyBucketResponse as LatencyBucketResponseSchema,
	PerIndexOverviewResponse as PerIndexOverviewResponseSchema,
	QuickwitBuildInfoResponse as QuickwitBuildInfoResponseSchema,
	QuickwitSnapshotResponse as QuickwitSnapshotResponseSchema,
	RecentResultResponse as RecentResultResponseSchema,
	RecentRowResponse as RecentRowResponseSchema,
	ResourceSnapshotResponse as ResourceSnapshotResponseSchema,
	SaturationSnapshotResponse as SaturationSnapshotResponseSchema,
	SummaryRowResponse as SummaryRowResponseSchema,
	TopActorRowResponse as TopActorRowResponseSchema,
	VolumeBucketResponse as VolumeBucketResponseSchema
} from './schemas/responses/admin.js';

export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;

export type ApiErrorDetail = {
	path: string;
	message: string;
};

export type ApiErrorBody = {
	error: {
		code: string;
		message: string;
		statusCode: number;
		requestId: string;
		details?: ApiErrorDetail[];
	};
};

export type IndexVisibility = (typeof INDEX_VISIBILITIES)[number];
export type IndexView = (typeof INDEX_VIEWS)[number];

export type IndexField = v.InferOutput<typeof IndexFieldSchema>;

export type IndexSource = {
	sourceId: string;
	sourceType: string;
	enabled: boolean;
};

export type SourceDetail = v.InferOutput<typeof SourceDetailResponseSchema>;

export type IndexSummary = v.InferOutput<typeof IndexListResponseSchema>[number];

export type IndexDetail = v.InferOutput<typeof IndexDetailResponseSchema>;

export type SaveIndexConfigFields = {
	displayName?: string | null;
	visibility?: IndexVisibility;
	levelField?: string;
	messageField?: string;
	tracebackField?: string | null;
	contextFields?: string[] | null;
};

export type IndexViewConfig = v.InferOutput<typeof IndexViewConfigResponseSchema>;

export type LogHit = Record<string, unknown>;

export type LogSearchResponse = v.InferOutput<typeof LogSearchResponseSchema>;

export type HistogramBucket = v.InferOutput<typeof HistogramBucketSchema>;

export type HistogramResponse = v.InferOutput<typeof HistogramResponseSchema>;

export type FieldValueEntry = v.InferOutput<typeof FieldValueEntrySchema>;

export type FieldValuesResponse = v.InferOutput<typeof FieldValuesResponseSchema>;

export type Filter = {
	field: string;
	value: string;
	/** When true, the composed query negates this clause (NOT field:"value"). */
	exclude: boolean;
};

export type SortDirection = 'asc' | 'desc';

export type FieldValuesBulkResponse = v.InferOutput<typeof FieldValuesBulkResponseSchema>;

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'expired';

export type User = v.InferOutput<typeof UserResponseSchema>;

export type InviteUrlResult = v.InferOutput<typeof InviteUrlResponseSchema>;

export type ApiKeyRole = 'ingest';

export type ApiKeySummary = v.InferOutput<typeof ApiKeyResponseSchema>;

export type PersonalApiKeySummary = v.InferOutput<typeof PersonalApiKeyResponseSchema>;

export type ApiKeyValue = v.InferOutput<typeof ApiKeyValueResponseSchema>;

export type VerifiedApiKey = {
	id: number;
	name: string;
	indexId: string;
	role: ApiKeyRole;
};

export type Scope = Record<string, string[]>;

export type { CreateApiKeyInput } from './schemas/api-keys.js';
export type { ShareCreateInput } from './schemas/shares.js';

export type SavedView = v.InferOutput<typeof SavedViewResponseSchema>;

export type ShareView = v.InferOutput<typeof ShareViewResponseSchema>;

export type DisplayMode = 'table' | 'inline';

export type Preferences = v.InferOutput<typeof PreferencesResponseSchema>;

export type GoogleAuthSettings = v.InferOutput<typeof GoogleAuthSettingsResponseSchema>;

export type GitHubAuthSettings = v.InferOutput<typeof GitHubAuthSettingsResponseSchema>;

export type AuthProvidersInfo = v.InferOutput<typeof AuthProvidersResponseSchema>;

export type IndexStatsPoint = v.InferOutput<typeof IndexStatsPointSchema>;

export type ClusterHealth = v.InferOutput<typeof ClusterHealthResponseSchema>;

export type ClusterTotals = v.InferOutput<typeof ClusterTotalsResponseSchema>;

export type PerIndexOverview = v.InferOutput<typeof PerIndexOverviewResponseSchema>;

export type ClusterOverview = v.InferOutput<typeof ClusterOverviewResponseSchema>;

export type QuickwitBuildInfo = v.InferOutput<typeof QuickwitBuildInfoResponseSchema>;

export type ResourceSnapshot = v.InferOutput<typeof ResourceSnapshotResponseSchema>;

// cpuBusyRatio is max(main, non_blocking) tokio worker busy ratio — Quickwit
// computes this over a recent window, so it's a real "right now" % rather than
// cumulative.
export type SaturationSnapshot = v.InferOutput<typeof SaturationSnapshotResponseSchema>;

export type QuickwitSnapshot = v.InferOutput<typeof QuickwitSnapshotResponseSchema>;

export type ExportFormat = 'json' | 'csv' | 'text';

// Index configuration (index.service.ts)
export type IndexSettings = {
	displayName: string | null;
	visibility: IndexVisibility;
	levelField: string;
	messageField: string;
	tracebackField: string | null;
	contextFields: string[] | null;
};

export type IndexConfig = {
	indexId: string;
	levelField: string;
	timestampField: string;
	messageField: string;
	tracebackField: string | null;
	contextFields: string[] | null;
};

export type QuickwitSource = {
	sourceId: string;
	sourceType: string;
	enabled: boolean;
	inputFormat: string | null;
	numPipelines: number | null;
	params: unknown | null;
	vrlScript: string | null;
};

export type QuickwitIndexMetadata = {
	indexId: string;
	indexUid: string | null;
	indexUri: string | null;
	version: string | null;
	createTimestamp: number | null;
	mode: string | null;
	timestampField: string | null;
	indexFieldPresence: boolean | null;
	storeSource: boolean | null;
	storeDocumentSize: boolean | null;
	tagFields: string[] | null;
	defaultSearchFields: string[] | null;
	retention: unknown | null;
	fields: IndexField[];
	sources: QuickwitSource[];
};

export type IndexMeta = {
	settings: IndexSettings;
	index: QuickwitIndexMetadata;
};

export type VerifyApiKeyResult = { status: 'ok'; key: VerifiedApiKey } | { status: 'not-found' };

// User administration (lib/auth-admin.ts)
export type CreateUserInput = {
	email: string;
	name: string;
	password: string;
	role: UserRole;
};

// Settings (settings.service.ts)
export type GoogleAuthCredentials = {
	clientId: string;
	clientSecret: string;
	allowedDomains: string[];
};

export type GitHubAuthCredentials = {
	clientId: string;
	clientSecret: string;
};

// Export streaming (export.service.ts)
export type FormatState = {
	csvHeader?: string[];
	preambleEmitted: boolean;
};

export type ExportPreflightResult = {
	total: number;
	capped: boolean;
	numHits: number;
	filename: string;
	contentType: string;
};

// Index stats (index-stats.service.ts)
export type LatestIndexSnapshot = {
	indexId: string;
	capturedAt: Date;
	numDocs: number;
	sizeBytes: number;
	uncompressedBytes: number;
	numSplits: number;
	minTimestamp: number | null;
	maxTimestamp: number | null;
};

// Quickwit Prometheus metrics (utils/quickwit-metrics.ts)
export type PromSample = {
	labels: Record<string, string>;
	value: number;
};

export type PromMetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'untyped';

export type PromMetric = {
	name: string;
	type: PromMetricType;
	help?: string;
	samples: PromSample[];
};

// Quickwit proxy (utils/quickwit-proxy.ts)
export type ProxyResult = {
	status: number;
	headers: Headers;
	bodyBytes: ArrayBuffer;
};

// Search activity (search-activity.service.ts)
export type SummaryRow = v.InferOutput<typeof SummaryRowResponseSchema>;

export type LatencyBucket = v.InferOutput<typeof LatencyBucketResponseSchema>;

export type TopActorRow = v.InferOutput<typeof TopActorRowResponseSchema>;

export type ActorSummaryRow = v.InferOutput<typeof ActorSummaryRowResponseSchema>;

export type VolumeBucket = v.InferOutput<typeof VolumeBucketResponseSchema>;

export type ActorIndexRow = v.InferOutput<typeof ActorIndexRowResponseSchema>;

export type RecentRow = v.InferOutput<typeof RecentRowResponseSchema>;

export type RecentResult = v.InferOutput<typeof RecentResultResponseSchema>;
