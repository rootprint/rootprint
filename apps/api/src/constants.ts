// API keys
export const INGEST_PREFIX = 'rp_';
export const API_KEY_RANDOM_BYTES = 24;
export const API_KEY_DISPLAY_PREFIX_LENGTH = 12;
export const LAST_USED_THROTTLE_SECONDS = 60;

// Defaults
export const INVITE_EXPIRY_HOURS = 48;
export const LAST_ACTIVE_THROTTLE_MS = 300_000;

// Export
export const EXPORT_MAX_ROWS = 10_000;

// Ingest
export const CONTENT_TYPE_PROTOBUF = 'application/x-protobuf';
export const CONTENT_TYPE_JSON = 'application/json';

// Search
export const FIELD_VALUES_MAX = 65_000;

/** Fallback `limit` for the field-values endpoint when the caller doesn't pass one. */
export const FIELD_VALUES_DEFAULT = 100;
