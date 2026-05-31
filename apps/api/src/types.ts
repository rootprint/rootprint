import type { INDEX_VISIBILITIES } from './constants/index-visibility.js';

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

export type Preferences = {
	displayFields: string[] | null;
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
