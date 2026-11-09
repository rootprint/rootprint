import { searchLogs } from '#lib/api/log-search.js';
import { hitTimestampSeconds, normalizeHit } from '#lib/components/logs/normalize-hit.js';
import { isUnfilterable, nameCollator } from '#lib/components/logs/drawer/hit-fields.js';
import { displayNameFor, isOtelAttr, isOtelResourceAttr } from '#lib/utils/fields.js';
import { isPlainObject } from '#lib/utils/object.js';
import type { ContextEntry, FieldConfig, Filter, LogHit, SearchInput } from '#lib/types.js';

const PAGE_SIZE = 200;
const WINDOW_SECONDS = 15 * 60;
/** After this many consecutive fully-empty slides in one direction, stop walking. */
const MAX_EMPTY_SLIDES = 3;
const MAX_OFFSET = 10_000;

type Dir = 'before' | 'after';
const SIGN = { before: -1, after: 1 } as const;

function createDirectionState(): {
	loading: boolean;
	noMore: boolean;
	limited: boolean;
	error: unknown;
} {
	return { loading: false, noMore: false, limited: false, error: null };
}

export type ContextScope = 'all' | 'service' | 'pod' | 'node' | 'custom';
type Preset = Exclude<ContextScope, 'all' | 'custom'>;

/** A `field = value` the anchor log offers to match on. */
export interface ScopePill {
	field: string;
	label: string;
	value: string | number | boolean;
}

// A preset is offered when the anchor has its first field.
const PRESET_FIELDS: Record<Preset, readonly string[]> = {
	service: ['service_name'],
	pod: ['resource_attributes.k8s.pod.name', 'resource_attributes.k8s.namespace.name'],
	node: ['resource_attributes.k8s.node.name']
};
const PRESETS: readonly Preset[] = ['service', 'pod', 'node'];

// Quickwit's tokenizers drop tokens of 255 bytes or more, so a longer value can never match.
const MAX_TERM_BYTES = 254;
const utf8 = new TextEncoder();
// Field names go into `field:value` unescaped; these characters make Quickwit's parser reject it.
const UNQUERYABLE_PATH = /[\s:()[\]{}'"!+^*`]/;

function isMatchable(value: unknown): value is string | number | boolean {
	if (typeof value === 'number' || typeof value === 'boolean') return true;
	return typeof value === 'string' && value !== '' && utf8.encode(value).length <= MAX_TERM_BYTES;
}

function pillGroup(field: string): number {
	if (isOtelResourceAttr(field)) return 0;
	return isOtelAttr(field) ? 1 : 2;
}

export function scopePills(raw: Record<string, unknown>, config: FieldConfig): ScopePill[] {
	const skipped = new Set([config.timestampField, config.messageField]);
	// Keyed by path: `{"http.route": …}` and `{"http": {"route": …}}` are the same field to Quickwit.
	const pills = new Map<string, ScopePill>();
	const walk = (path: string, value: unknown): void => {
		if (skipped.has(path) || isUnfilterable(path, config) || UNQUERYABLE_PATH.test(path)) return;
		if (isPlainObject(value)) {
			for (const [key, child] of Object.entries(value)) walk(`${path}.${key}`, child);
		} else if (isMatchable(value)) {
			pills.set(path, { field: path, label: displayNameFor(path, config.isOtel), value });
		}
	};
	for (const [key, value] of Object.entries(raw)) walk(key, value);
	return [...pills.values()].toSorted(
		(a, b) => pillGroup(a.field) - pillGroup(b.field) || nameCollator.compare(a.label, b.label)
	);
}

export function availableScopes(pills: readonly ScopePill[]): ContextScope[] {
	const fields = new Set(pills.map((p) => p.field));
	return ['all', ...PRESETS.filter((p) => fields.has(PRESET_FIELDS[p][0])), 'custom'];
}

export function resolveScope(
	scope: ContextScope,
	available: readonly ContextScope[]
): ContextScope {
	if (available.includes(scope)) return scope;
	return available.includes('service') ? 'service' : 'all';
}

export function scopeMatches(
	pills: readonly ScopePill[],
	scope: ContextScope,
	customFields: readonly string[]
): ScopePill[] {
	if (scope === 'all') return [];
	const fields: readonly string[] = scope === 'custom' ? customFields : PRESET_FIELDS[scope];
	return pills.filter((p) => fields.includes(p.field));
}

export function scopeFilters(matches: readonly ScopePill[]): Filter[] {
	return matches.map((p) => ({ field: p.field, value: String(p.value), exclude: false }));
}

function hitKey(hit: Record<string, unknown>): string {
	const id = hit['_id'];
	if (typeof id === 'string' && id.length > 0) return id;
	return JSON.stringify(hit);
}

export class ContextLoader {
	readonly anchor: LogHit;
	readonly anchorTs: number; // seconds since epoch
	readonly indexId: string;
	readonly fieldConfig: FieldConfig;
	readonly query: string;

	entries = $state.raw<ContextEntry[]>([]);

	before = $state(createDirectionState());
	after = $state(createDirectionState());
	error = $state<string | null>(null);
	/** The initial fetch settled, successfully or not. */
	ready = $state(false);

	// Each direction searches a 15-minute window; offset counts consumed hits in its boundary second.
	#win: Record<Dir, { bound: number; offset: number; empty: number }>;
	#seenKeys: Set<string>;
	readonly #abort = new AbortController();
	#nextEntryKey = 0;

	constructor(anchor: LogHit, indexId: string, fieldConfig: FieldConfig, query: string) {
		this.anchor = anchor;
		this.indexId = indexId;
		this.fieldConfig = fieldConfig;
		this.query = query;
		this.anchorTs = hitTimestampSeconds(anchor.raw, fieldConfig);
		this.#win = {
			before: { bound: this.anchorTs, offset: 0, empty: 0 },
			after: { bound: this.anchorTs, offset: 0, empty: 0 }
		};
		this.#seenKeys = new Set([hitKey(anchor.raw)]);
		this.entries = [this.#toEntry(anchor.raw, true)];
	}

	#request(dir: Dir): SearchInput {
		const { bound, offset } = this.#win[dir];
		const desc = dir === 'before';
		return {
			indexId: this.indexId,
			query: this.query,
			limit: PAGE_SIZE,
			offset,
			sortDirection: desc ? 'desc' : 'asc',
			startTs: desc ? bound - WINDOW_SECONDS : bound,
			endTs: desc ? bound : bound + WINDOW_SECONDS
		};
	}

	#advance(dir: Dir, hits: Record<string, unknown>[]): void {
		const w = this.#win[dir];
		const rowCount = hits.length;
		w.empty = rowCount === 0 ? w.empty + 1 : 0;
		if (rowCount >= PAGE_SIZE) {
			const boundaryTs = hitTimestampSeconds(hits[rowCount - 1], this.fieldConfig);
			const bound = boundaryTs + (dir === 'before' ? 1 : 0);
			let offset = bound === w.bound ? w.offset + 1 : 1;
			for (let i = rowCount - 2; i >= 0; i--) {
				if (hitTimestampSeconds(hits[i], this.fieldConfig) !== boundaryTs) break;
				offset++;
			}
			// A saturated second cannot be traversed safely without a tie-aware cursor.
			if (!Number.isFinite(bound) || SIGN[dir] * (bound - w.bound) < 0 || offset > MAX_OFFSET) {
				this[dir].limited = true;
				return;
			}
			w.bound = bound;
			w.offset = offset;
			return;
		}
		w.bound += SIGN[dir] * WINDOW_SECONDS;
		w.offset = 0;
		this[dir].noMore = w.empty >= MAX_EMPTY_SLIDES;
	}

	async init(): Promise<void> {
		if (!Number.isFinite(this.anchorTs)) {
			this.error = 'This log has an invalid timestamp; surrounding context cannot be loaded.';
			this.ready = true;
			return;
		}
		await Promise.all([this.#loadPage('after'), this.#loadPage('before')]);
		this.ready = true;
	}

	/** The ±15-minute absolute window centered on the anchor, for the search-page handoff. */
	getSearchHandoff(): { start: number; end: number } {
		return {
			start: this.anchorTs - WINDOW_SECONDS,
			end: this.anchorTs + WINDOW_SECONDS
		};
	}

	async loadMore(dir: Dir, retry = false): Promise<void> {
		if (this.#abort.signal.aborted || !this.ready || this.error) return;
		const state = this[dir];
		if (state.loading || state.noMore || state.limited) return;
		if (state.error && !retry) return;
		await this.#loadPage(dir);
	}

	async #loadPage(dir: Dir): Promise<void> {
		const { signal } = this.#abort;
		const state = this[dir];
		state.loading = true;
		state.error = null;
		try {
			const result = await searchLogs(this.#request(dir), signal);
			if (signal.aborted) return;
			const fresh = this.#toEntries(result.rawHits);
			if (fresh.length > 0) {
				this.entries =
					dir === 'before' ? [...this.entries, ...fresh] : [...fresh.toReversed(), ...this.entries];
			}
			this.#advance(dir, result.rawHits);
		} catch (e) {
			if (signal.aborted) return;
			state.error = e;
		} finally {
			if (!signal.aborted) state.loading = false;
		}
	}

	dispose(): void {
		this.#abort.abort();
	}

	#toEntries(hits: Record<string, unknown>[]): ContextEntry[] {
		const out: ContextEntry[] = [];
		for (const h of hits) {
			const k = hitKey(h);
			if (this.#seenKeys.has(k)) continue;
			this.#seenKeys.add(k);
			out.push(this.#toEntry(h, false));
		}
		return out;
	}

	#toEntry(hit: Record<string, unknown>, isAnchor: boolean): ContextEntry {
		return { ...normalizeHit(hit, this.#nextEntryKey++, this.fieldConfig), isAnchor };
	}
}
