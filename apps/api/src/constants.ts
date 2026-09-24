// API keys
export const INGEST_PREFIX = 'rp_';
export const API_KEY_RANDOM_BYTES = 24;
export const API_KEY_DISPLAY_PREFIX_LENGTH = 12;
export const LAST_USED_THROTTLE_SECONDS = 60;

// Auth
export const USER_ADDITIONAL_FIELDS = {
	role: { type: 'string', required: false, defaultValue: 'user', input: false },
	lastActive: { type: 'date', required: false, returned: true }
} as const;

// Defaults
export const INVITE_EXPIRY_HOURS = 48;
export const LAST_ACTIVE_THROTTLE_MS = 300_000;

// Export
export const EXPORT_MAX_ROWS = 10_000;

// Ingest
export const CONTENT_TYPE_PROTOBUF = 'application/x-protobuf';
export const CONTENT_TYPE_JSON = 'application/json';

// Search
/** The log search `limit` ceiling; the trace page's per-span log counts read up to it. */
export const SEARCH_MAX_LIMIT = 1000;

export const FIELD_VALUES_MAX = 65_000;

/** Fallback `limit` for the field-values endpoint when the caller doesn't pass one. */
export const FIELD_VALUES_DEFAULT = 100;

// Monitoring errors
export const SPAN_KINDS = ['server', 'client', 'producer', 'consumer', 'internal'] as const;
export type SpanKind = (typeof SPAN_KINDS)[number];
export const ERROR_HTTP_STATUSES = ['4xx', '5xx', 'none'] as const;

const HTTP_RESPONSE_STATUS_FIELD = 'span_attributes.http.response.status_code';
const HTTP_STATUS_FIELD = 'span_attributes.http.status_code';
const httpStatusRange = (lower: number) =>
	`(${HTTP_RESPONSE_STATUS_FIELD}:[${lower} TO ${lower + 99}] OR ${HTTP_STATUS_FIELD}:[${lower} TO ${lower + 99}])`;

// Shared with the web so "Open in Traces" matches exactly the spans the Errors tab lists.
export const ERROR_KIND_CLAUSES: Record<SpanKind, string> = {
	server: 'span_kind:2',
	client: 'span_kind:3',
	producer: 'span_kind:4',
	consumer: 'span_kind:5',
	internal: 'span_kind:IN [0 1]'
};
export const ERROR_HTTP_STATUS_CLAUSES: Record<(typeof ERROR_HTTP_STATUSES)[number], string> = {
	'4xx': httpStatusRange(400),
	'5xx': httpStatusRange(500),
	none: `NOT (${HTTP_RESPONSE_STATUS_FIELD}:* OR ${HTTP_STATUS_FIELD}:*)`
};

export const ERROR_PAGE_SIZE = 50;
export const MAX_ERROR_LIMIT = 100;

/** The web list stops paginating here, so both sides must read the same ceiling. */
export const MAX_ERROR_OFFSET = 5_000;

// Trace explorer
export const EXPLORE_STATUSES = ['all', 'error', 'ok'] as const;
export type ExploreStatus = (typeof EXPLORE_STATUSES)[number];
export const EXPLORE_SORTS = ['-start', 'start', '-duration', 'duration'] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];
export const EXPLORE_PAGE_SIZE = 50;
export const MAX_EXPLORE_LIMIT = 100;

/** Quickwit rejects a start_offset above 10k, so the web list stops paginating here too. */
export const MAX_EXPLORE_OFFSET = 10_000;

// Time ranges
export const PRESET_OPTIONS = [
	'5m',
	'15m',
	'30m',
	'1h',
	'3h',
	'6h',
	'24h',
	'3d',
	'7d',
	'30d'
] as const;
export type Preset = (typeof PRESET_OPTIONS)[number];
