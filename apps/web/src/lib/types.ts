import type { Preset } from '$lib/utils/time-range';
import type { Filter, SortDirection } from 'api/types';

export type { Filter, SortDirection };

/** One crumb in a breadcrumb trail. Ancestors set `href`; the current page omits it. */
export type BreadcrumbSegment = { label: string; href?: string; mono?: boolean };

export type IndexTabId = 'config' | 'fields' | 'sources';

export type TimezoneMode = 'utc' | 'local';
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface LevelBucket {
	name: string;
	/** `null` means the level was previously observed but is absent from the latest histogram — typically filtered out. */
	count: number | null;
}

export interface LogField {
	name: string;
	displayName: string;
	/** Quickwit field type, e.g. "text", "i64", "u64", "f64", "bool", "datetime", "ip", "json". */
	type: string;
}

export interface LogHit {
	key: string;
	timestamp: string;
	/** Severity level — must match a LevelBucket.name when one exists. */
	level: string;
	message: string;
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
	/** Admin-configured field paths that should pre-pin as chips when the Context pane opens. */
	contextFields: string[];
	isOtel: boolean;
}

export interface IndexOption {
	id: string;
	name: string;
}

export interface LogFieldValueBucket {
	value: string;
	count: number;
}

export type TimeRange =
	| { type: 'relative'; preset: Preset }
	| { type: 'absolute'; start: number; end: number };

export interface ParsedQuery {
	index: string | null;
	query: string;
	timeRange: TimeRange;
	timezoneMode: TimezoneMode;
	sortDirection: SortDirection;
	filters: Filter[];
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
	elapsedTimeMicros: number;
	startTimestamp?: number;
	endTimestamp?: number;
}

/** A single scope filter pinned in the Context view. AND-joined into the query. */
export interface ContextChip {
	field: string;
	value: unknown;
}

/** A log hit rendered inside the Context view. Same shape as LogHit with an anchor flag. */
export type ContextEntry = LogHit & {
	isAnchor: boolean;
};
