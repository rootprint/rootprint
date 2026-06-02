import type { INDEX_VISIBILITIES } from './constants.js';

export type HealthResponse = {
	status: 'ok';
};

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

export type IndexField = {
	name: string;
	type: string;
	fast: boolean | null;
};

export type IndexSource = {
	sourceId: string;
	sourceType: string;
	enabled: boolean;
};

export type IndexSummary = {
	indexId: string;
	displayName: string | null;
	visibility: IndexVisibility;
	fieldCount: number;
	sourceCount: number;
	mode: string | null;
	createTimestamp: number | null;
};

export type IndexDetail = {
	indexId: string;
	displayName: string | null;
	visibility: IndexVisibility;
	levelField: string;
	messageField: string;
	tracebackField: string | null;
	contextFields: string[] | null;
	indexUri: string | null;
	timestampField: string | null;
	mode: string | null;
	tagFields: string[] | null;
	defaultSearchFields: string[] | null;
	storeSource: boolean | null;
	fields: IndexField[];
	sources: IndexSource[];
};

export type SaveIndexConfigFields = {
	displayName?: string | null;
	visibility?: IndexVisibility;
	levelField?: string;
	messageField?: string;
	tracebackField?: string | null;
	contextFields?: string[] | null;
};

export type IndexViewConfig = {
	indexId: string;
	displayName: string | null;
	levelField: string;
	messageField: string;
	tracebackField: string | null;
	/** Field names to pre-pin as chips when the log-detail Context pane opens. */
	contextFields: string[] | null;
	/** Non-null: the endpoint throws when the underlying Quickwit index has no timestamp field. */
	timestampField: string;
	/** True when the index ID has the `otel-` prefix used by Quickwit's OTel service. */
	isOtel: boolean;
};

export type LogHit = Record<string, unknown>;

export type LogSearchResponse = {
	hits: LogHit[];
	numHits: number;
	elapsedTimeMicros: number;
};

export type HistogramBucket = {
	key: number;
	keyAsString: string;
	docCount: number;
	levels: Record<string, number>;
};

export type HistogramResponse = {
	buckets: HistogramBucket[];
};

export type FieldValueEntry = {
	value: string;
	count: number;
};

export type FieldValuesResponse = {
	values: FieldValueEntry[];
};

export type Filter = {
	field: string;
	value: string;
	/** When true, the composed query negates this clause (NOT field:"value"). */
	exclude: boolean;
};

export type FieldValuesBulkResponse = {
	values: Record<string, FieldValueEntry[]>;
	elapsedTimeMicros?: number;
};

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'pending' | 'expired';

export type User = {
	id: string;
	name: string;
	email: string;
	role: UserRole | null;
	lastActive: Date | null;
	status: UserStatus;
	hasCredentialAccount: boolean;
	inviteUrl: string | null;
	inviteExpiresAt: Date | null;
};

export type ApiKeyRole = 'ingest' | 'search';

export type ApiKeySummary = {
	id: number;
	name: string;
	tokenPrefix: string;
	role: ApiKeyRole;
	indexId: string;
	lastUsedAt: Date | null;
	createdAt: Date;
	createdByUserId: string;
};

export type ApiKeyValue = {
	token: string;
};

export type VerifiedApiKey = {
	id: number;
	name: string;
	indexId: string;
	role: ApiKeyRole;
};

export type { CreateApiKeyInput } from './schemas/api-keys.js';

export type SavedQuery = {
	id: number;
	indexId: string;
	name: string;
	description: string | null;
	query: string;
	createdAt: Date;
	updatedAt: Date;
};

export type ShareCreateInput = {
	indexId: string;
	query: string;
	startTime: number;
	endTime: number;
	hit: Record<string, unknown>;
};

export type ShareView = {
	indexId: string;
	query: string;
	startTime: number;
	endTime: number;
	hit: Record<string, unknown>;
};

export type DisplayMode = 'table' | 'inline';

export type Preferences = {
	displayFields: string[] | null;
	lineWrap: boolean;
	displayMode: DisplayMode;
};

export type GoogleAuthSettings = {
	configured: boolean;
	allowedDomains: string[];
};

export type AuthProvidersInfo = {
	google: { enabled: boolean };
};

export type IndexStatsPoint = {
	capturedAt: Date;
	numDocs: number;
	sizeBytes: number;
	uncompressedBytes: number;
	numSplits: number;
	minTimestamp: number | null;
	maxTimestamp: number | null;
};

export type ClusterHealth = {
	healthy: boolean;
	endpoint: string;
};

export type ClusterTotals = {
	indexCount: number;
	totalDocs: number;
	totalSizeBytes: number;
	totalSplits: number;
	latestCapturedAt: string | null;
};

export type PerIndexOverview = {
	indexId: string;
	displayName: string | null;
	visibility: IndexVisibility;
	numDocs: number | null;
	sizeBytes: number | null;
	uncompressedBytes: number | null;
	numSplits: number | null;
	capturedAt: string | null;
};

export type ClusterOverview = {
	health: ClusterHealth;
	totals: ClusterTotals;
	perIndex: PerIndexOverview[];
};

export type QuickwitBuildInfo = {
	version: string | null;
};

export type ResourceSnapshot = {
	memoryRssBytes: number | null;
	fdsOpen: number | null;
	fdsMax: number | null;
	walDiskBytes: number | null;
};

export type SaturationSnapshot = {
	// max(main, non_blocking) tokio worker busy ratio — Quickwit computes this
	// over a recent window, so it's a real "right now" % rather than cumulative.
	cpuBusyRatio: number | null;
};

export type QuickwitSnapshot = {
	fetchedAt: string;
	build: QuickwitBuildInfo;
	uptimeSeconds: number | null;
	resources: ResourceSnapshot;
	saturation: SaturationSnapshot;
};

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

// API key verification (api-key.service.ts)
export type VerifyApiKeyResult =
	| { status: 'ok'; key: VerifiedApiKey }
	| { status: 'wrong-role'; actualRole: ApiKeyRole }
	| { status: 'not-found' };

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
export type SummaryRow = {
	totalSearches: number;
	errorCount: number;
	p50: number | null;
	p95: number | null;
	p99: number | null;
};

export type LatencyBucket = {
	t: string; // ISO timestamp at bucket start
	count: number;
	p50: number | null;
	p95: number | null;
	p99: number | null;
};

export type TopActorRow = {
	kind: 'user' | 'apiKey';
	id: string;
	label: string | null;
	count: number;
	avgDurationMs: number;
	errorCount: number;
	indexes: string[];
};

export type ActorSummaryRow = SummaryRow & {
	displayName: string | null;
	email: string | null;
};

export type VolumeBucket = { t: string; count: number };

export type ActorIndexRow = {
	indexId: string;
	count: number;
	avgDurationMs: number;
	errorCount: number;
};

export type RecentRow = {
	id: number;
	executedAt: string;
	indexId: string;
	durationMs: number;
	numHits: number | null;
	query: string;
	startTs: number | null;
	endTs: number | null;
};

export type RecentResult = {
	rows: RecentRow[];
	total: number;
};
