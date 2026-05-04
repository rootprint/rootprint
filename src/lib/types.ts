type RelativeTimeRange = { type: 'relative'; preset: string };
type AbsoluteTimeRange = { type: 'absolute'; start: number; end: number };
export type TimeRange = RelativeTimeRange | AbsoluteTimeRange;

export type TimezoneMode = 'utc' | 'local';

export type SortDirection = 'asc' | 'desc';

export type DrawerTab = 'history' | 'saved' | 'shared';

export type IndexDetailTab = 'overview' | 'fields' | 'sources' | 'configuration';

export type ExportFormat = 'ndjson' | 'csv' | 'text';

export type WrapMode = 'none' | 'wrap';

export type NodeLogFlavor = 'otel' | 'pino' | 'winston';

export type CaddyLogFlavor = 'bare-metal' | 'docker';

export type IndexField = { name: string; type: string; fast: boolean };

export type IndexVisibility = 'hidden' | 'admin' | 'all';

export type IndexRetention = { period?: string; schedule?: string };

export type AdminIndexSummary = {
	indexId: string;
	displayName: string | null;
	mode: string | null;
	fieldCount: number;
	sourceCount: number;
	createTimestamp: number | null;
	visibility: IndexVisibility;
};

export type QuickwitField = {
	name: string;
	type: string;
	fast: boolean | null;
	indexed: boolean | null;
	stored: boolean | null;
	record: string | null;
	tokenizer: string | null;
	description: string | null;
};

export type QuickwitSource = {
	sourceId: string;
	sourceType: string;
	enabled: boolean;
	inputFormat: string | null;
	numPipelines: number | null;
	params: unknown;
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
	retention: IndexRetention | null;
	fields: QuickwitField[];
	sources: QuickwitSource[];
};

export type AdminIndexDetail = {
	indexId: string;
	indexUid: string | null;
	indexUri: string | null;
	version: string | null;
	createTimestamp: number | null;
	timestampField: string | null;
	mode: string | null;
	indexFieldPresence: boolean | null;
	storeSource: boolean | null;
	storeDocumentSize: boolean | null;
	tagFields: string[] | null;
	defaultSearchFields: string[] | null;
	retention: IndexRetention | null;
	levelField: string | null;
	messageField: string | null;
	tracebackField: string | null;
	displayName: string | null;
	visibility: IndexVisibility;
	contextFields: string[] | null;
	fields: QuickwitField[];
	sources: QuickwitSource[];
};

export type SaveIndexConfigFields = {
	levelField?: string;
	messageField?: string;
	tracebackField?: string | null;
	displayName?: string | null;
	visibility?: IndexVisibility;
	contextFields?: string[] | null;
};

export type IndexSummary = {
	indexId: string;
	indexUri: string;
	displayName: string | null;
	visibility: IndexVisibility;
};

export type LogEntry = { key: number; hit: Record<string, unknown> };

export type UserRole = 'admin' | 'user';

export type User = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	lastActive: Date | null;
	status: 'pending' | 'active' | 'expired';
	hasCredentialAccount: boolean;
	inviteUrl: string | null;
	inviteExpiresAt: Date | null;
};

export type AdminUserTarget = { id: string; name: string };

export type MemberFilter = 'all' | 'admin' | 'pending';

export type Clause = { field: string; value: string; exclude: boolean };

export interface ParsedQuery {
	index: string | null;
	query: string;
	timeRange: TimeRange;
	timezoneMode: TimezoneMode;
	sortDirection: SortDirection;
}

export type QueryContext =
	| { type: 'field'; fragment: string; start: number; end: number }
	| { type: 'value'; field: string; fragment: string; start: number; end: number }
	| { type: 'none' };

export type Formatter = (value: unknown) => string;

export interface TracebackFormatter {
	detect(text: string): boolean;
	highlight(text: string): string;
}

export type HistoryEntry = {
	id: number;
	userId: string;
	indexName: string;
	query: string;
	timeRange: TimeRange;
	executedAt: Date;
};

export type SavedQueryEntry = {
	id: number;
	userId: string;
	indexName: string;
	name: string;
	description: string | null;
	query: string;
	isShared: boolean;
	createdAt: Date;
};

export type SharedQueryEntry = {
	id: number;
	userId: string;
	indexName: string;
	name: string;
	description: string | null;
	query: string;
	username: string;
	createdAt: Date;
};

export type ViewSummary = {
	id: number;
	userId: string;
	indexName: string;
	name: string;
	query: string;
	columns: string[];
	createdAt: Date;
};

// One of `icon` (iconify) or `iconSrc` (image asset URL) is set; preference
// goes to iconify when both happen to be present.
export type BuiltinViewIcon =
	| { iconifyIcon: import('@iconify/types').IconifyIcon }
	| { iconSrc: string };

export type BuiltinView = {
	slug: string;
	name: string;
	query: string;
	columns: string[];
	icon: BuiltinViewIcon;
};

export type ActiveViewRef = { kind: 'builtin'; slug: string } | { kind: 'user'; id: number };

export type GoogleAuthSettings = {
	clientId: string;
	clientSecret: string;
	allowedDomains: string[];
};

export type GoogleAuthSettingsView = {
	clientId: string;
	clientSecretMasked: string;
	allowedDomains: string[];
};

export type IngestTokenSummary = {
	id: number;
	name: string;
	tokenPrefix: string;
	indexId: string;
	lastUsedAt: Date | null;
	createdAt: Date;
	createdByUserId: string;
};

export type VerifiedIngestToken = { id: number; name: string; indexId: string };

export type QuickFilterBucket = {
	value: string;
	count: number | null;
};

export type ExportStatus = 'pending' | 'fetching' | 'compressing' | 'complete' | 'error';

export type ExportState = {
	status: ExportStatus;
	userId: string;
	fetched: number;
	total: number;
	format: ExportFormat;
	logs: Record<string, unknown>[];
	result?: Uint8Array;
	error?: string;
	filename: string;
	createdAt: number;
};

export type AuthProviderId = 'google';

export type AuthProviderRow = {
	id: AuthProviderId;
	name: string;
	description: string;
	configured: boolean;
	statusLine: string | null;
	editHref: string;
};

export type IndexStatsCard = {
	lastIngest: {
		timestamp: number | null;
		ageSeconds: number | null;
	};
	ingestion24h: {
		count: number | null;
		deltaPct: number | null;
	};
	size: {
		bytes: number;
		uncompressedBytes: number;
		numSplits: number;
		compressionRatio: number | null;
	};
	growth7d: {
		bytesPerDay: number | null;
		totalBytes: number | null;
	};
};

export type QuickwitStatus = 'ok' | 'unreachable';

export type LoadingMode = 'idle' | 'fresh' | 'appending';
