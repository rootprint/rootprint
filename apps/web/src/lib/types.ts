import type { InferResponseType } from "hono/client";

import type { client } from "$lib/api/client";

export type UserView = InferResponseType<typeof client.api.users.$get, 200>[number];

export type GoogleAuthSettingsView = InferResponseType<typeof client.api.settings.auth.google.$get, 200>;

export type IndexTabId = 'config' | 'fields' | 'sources';

/* ===== Log viewer (frontend scaffold) ===== */

export type WrapMode = 'none' | 'truncate' | 'wrap';
export type DrawerTab = 'history' | 'saved' | 'shared';
export type TimezoneMode = 'utc' | 'local';
export type SortDirection = 'asc' | 'desc';

export type LogListState = 'loading' | 'error' | 'empty' | 'logs';

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
  /** Distinct value count, or null if unknown. */
  cardinality: number | null;
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
  /** ISO 8601 timestamp string at the start of the bucket. */
  timestamp: string;
  /** Hit count for the bucket. */
  count: number;
}

export interface FieldConfig {
  timestampField: string;
  levelField: string;
  messageField: string;
  tracebackField: string;
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
