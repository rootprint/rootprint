export type IndexTabId = 'config' | 'fields' | 'sources';

/* ===== Log viewer (frontend scaffold) ===== */

export type TimezoneMode = 'utc' | 'local';
export type SortDirection = 'asc' | 'desc';

export interface LevelBucket {
  /** Level name as it appears in the index (e.g. "info", "warn", "error"). */
  name: string;
  /** Hit count for this level. */
  count: number;
}

export interface LogField {
  /** Internal field name (e.g. "attributes.http.status_code"). */
  name: string;
  /** Display name (e.g. "http.status_code" — what the user sees). */
  displayName: string;
  /** Quickwit field type, e.g. "text", "i64", "u64", "f64", "bool", "datetime", "ip", "json". */
  type: string;
}

export interface LogHit {
  /** Stable key for the keyed each-block. */
  key: string;
  /** ISO 8601 timestamp string. */
  timestamp: string;
  /** Severity level — must match a LevelBucket.name when one exists. */
  level: string;
  /** Primary message text. */
  message: string;
  /** Raw event JSON. Used by LogDetailDrawer. */
  raw: Record<string, unknown>;
}

export interface HistogramBucket {
  /** Seconds since epoch at the start of the bucket. */
  timestamp: number;
  /** Per-level doc counts within this bucket, keyed by raw level value. */
  levels: Record<string, number>;
  /** Total hit count for the bucket (sum across levels). */
  count: number;
}

export interface HistogramInput {
  indexId: string;
  query: string;
  timeRange?: string;
  startTimestamp?: number;
  endTimestamp?: number;
}

export interface HistogramResult {
  buckets: HistogramBucket[];
}

export interface FieldConfig {
  timestampField: string;
  levelField: string;
  messageField: string;
  tracebackField: string;
  isOtel: boolean;
}

export interface IndexOption {
  id: string;
  name: string;
}

export interface LogFieldValueBucket {
  /** A distinct value observed for a field (e.g. "GET", "/api/checkout"). */
  value: string;
  /** Hit count for this value within the current result set. */
  count: number;
}

export type TimeRange =
  | { type: 'relative'; preset: string }
  | { type: 'absolute'; start: number; end: number };

export interface ParsedQuery {
  index: string | null;
  query: string;
  timeRange: TimeRange;
  timezoneMode: TimezoneMode;
  sortDirection: SortDirection;
}

export interface SearchInput {
  indexId: string;
  query: string;
  timeRange?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  sortDirection: SortDirection;
  limit: number;
  offset: number;
}

export interface SearchResult {
  rawHits: Record<string, unknown>[];
  numHits: number;
  startTimestamp?: number;
  endTimestamp?: number;
}
