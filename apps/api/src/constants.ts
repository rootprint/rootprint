// API keys
export const INGEST_PREFIX = 'lwit_';
export const API_KEY_RANDOM_BYTES = 24;
export const API_KEY_DISPLAY_PREFIX_LENGTH = 12;
export const LAST_USED_THROTTLE_SECONDS = 60;

// Defaults
export const INVITE_EXPIRY_HOURS = 48;
export const LAST_ACTIVE_THROTTLE_MS = 300_000;

// Export
export const EXPORT_MAX_ROWS = 10_000;

// Index visibility
export const INDEX_VISIBILITIES = ['hidden', 'admin', 'all'] as const;

// Index listing / meta-access view. `search` applies visibility filtering;
// `admin` returns everything but is honored only for real admins (fail closed).
export const INDEX_VIEWS = ['search', 'admin'] as const;

// Ingest
export const CONTENT_TYPE_PROTOBUF = 'application/x-protobuf';
export const CONTENT_TYPE_NDJSON = 'application/x-ndjson';
export const CONTENT_TYPE_JSON = 'application/json';

// Search
/** Hard cap on the per-field terms aggregation size accepted by `GET /api/indexes/:indexId/fields/:field/values`. */
export const FIELD_VALUES_MAX = 10_000;

/** Fallback `limit` for the field-values endpoint when the caller doesn't pass one. */
export const FIELD_VALUES_DEFAULT = 100;
