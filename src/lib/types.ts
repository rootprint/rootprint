type RelativeTimeRange = { type: 'relative'; preset: string };
type AbsoluteTimeRange = { type: 'absolute'; start: number; end: number };
export type TimeRange = RelativeTimeRange | AbsoluteTimeRange;

export type TimezoneMode = 'utc' | 'local';

export type SortDirection = 'asc' | 'desc';

export type DrawerTab = 'history' | 'saved' | 'shared';

export const TIME_PRESETS = [
	{ label: 'Last 5 minutes', code: '5m', seconds: 5 * 60 },
	{ label: 'Last 15 minutes', code: '15m', seconds: 15 * 60 },
	{ label: 'Last 30 minutes', code: '30m', seconds: 30 * 60 },
	{ label: 'Last 1 hour', code: '1h', seconds: 60 * 60 },
	{ label: 'Last 3 hours', code: '3h', seconds: 3 * 60 * 60 },
	{ label: 'Last 6 hours', code: '6h', seconds: 6 * 60 * 60 },
	{ label: 'Last 1 day', code: '1d', seconds: 24 * 60 * 60 },
	{ label: 'Last 3 days', code: '3d', seconds: 3 * 24 * 60 * 60 },
	{ label: 'Last 1 week', code: '1w', seconds: 7 * 24 * 60 * 60 },
	{ label: 'Last 1 month', code: '1M', seconds: 30 * 24 * 60 * 60 }
] as const;

export type IndexField = { name: string; type: string; fast: boolean };

export type IndexVisibility = 'hidden' | 'admin' | 'all';

export type SaveIndexConfigFields = {
	levelField?: string;
	messageField?: string;
	tracebackField?: string;
	displayName?: string | null;
	visibility?: IndexVisibility;
	contextFields?: string[] | null;
	stickyFilterFields?: string[] | null;
};

export type IndexSummary = {
	indexId: string;
	indexUri: string;
	displayName: string | null;
	visibility: IndexVisibility;
};

export type LogEntry = { key: number; hit: Record<string, unknown> };

export type User = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	lastActive: Date | null;
	status: 'pending' | 'active';
	authProvider: 'google' | 'credential';
	inviteUrl: string | null;
	inviteExpiresAt: Date | null;
};

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

export const AUTO_REFRESH_INTERVALS = [
	{ label: '5s', ms: 5_000 },
	{ label: '10s', ms: 10_000 },
	{ label: '30s', ms: 30_000 },
	{ label: '1m', ms: 60_000 }
] as const;

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

export type IngestTokenScope = {
	indexIds: string[] | null;
};

export type IngestTokenSummary = {
	id: number;
	name: string;
	tokenPrefix: string;
	scope: IngestTokenScope;
	revokedAt: Date | null;
	lastUsedAt: Date | null;
	createdAt: Date;
	createdByUserId: string;
};

export type CreateIngestTokenResult = {
	token: string;
	summary: IngestTokenSummary;
};

export type QuickFilterBucket = {
	value: string;
	count: number | null;
};
