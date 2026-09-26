import { searchLogs } from '$lib/api/log-search';
import { isAbortError } from '$lib/api/errors';
import { getByPath } from '$lib/components/logs/get-by-path';
import { escapeFilterValue } from 'api/query';
import { hitTimestampSeconds, normalizeHit } from '$lib/components/logs/normalize-hit';
import type { ContextChip, ContextEntry, FieldConfig, LogHit, SearchInput } from '$lib/types';

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

export function seedChipsFromIndex(
	anchor: Record<string, unknown>,
	fields: readonly string[]
): ContextChip[] {
	const out: ContextChip[] = [];
	for (const field of fields) {
		const value = getByPath(anchor, field);
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && value.length === 0) continue;
		out.push({ field, value });
	}
	return out;
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

	chips = $state<ContextChip[]>([]);
	entries = $state.raw<ContextEntry[]>([]);

	loadingInitial = $state(false);
	before = $state(createDirectionState());
	after = $state(createDirectionState());
	error = $state<string | null>(null);
	/** Pane watches this to scroll to the anchor after initial results or a failure. */
	initEpoch = $state(0);

	// Each direction searches a 15-minute window; offset counts consumed hits in its boundary second.
	#win = {
		before: { bound: 0, offset: 0, empty: 0 },
		after: { bound: 0, offset: 0, empty: 0 }
	};
	#seenKeys = new Set<string>();
	#abort: AbortController | null = null;
	#fetchSeq = 0;
	#nextEntryKey = 0;
	readonly #anchorKey: string;

	constructor(
		anchor: LogHit,
		indexId: string,
		fieldConfig: FieldConfig,
		initialChips: ContextChip[] = []
	) {
		this.anchor = anchor;
		this.indexId = indexId;
		this.fieldConfig = fieldConfig;
		this.anchorTs = hitTimestampSeconds(anchor.raw, fieldConfig);
		this.#anchorKey = hitKey(anchor.raw);
		this.chips = initialChips;
	}

	#request(dir: Dir): SearchInput {
		const { bound, offset } = this.#win[dir];
		const desc = dir === 'before';
		return {
			indexId: this.indexId,
			query: this.composedQuery,
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

	/** AND-joined chip query used by internal fetches; '*' when no chips. */
	get composedQuery(): string {
		return this.#buildChipClause() || '*';
	}

	#buildChipClause(): string {
		return this.chips.map((c) => `${c.field}:${escapeFilterValue(String(c.value))}`).join(' AND ');
	}

	async init(): Promise<void> {
		this.#abort?.abort();
		this.#abort = new AbortController();
		const thisSeq = ++this.#fetchSeq;
		for (const dir of ['before', 'after'] as const) {
			this[dir] = createDirectionState();
			this.#win[dir] = { bound: this.anchorTs, offset: 0, empty: 0 };
		}
		this.error = null;
		this.entries = [this.#toEntry(this.anchor.raw, true)];
		this.#seenKeys = new Set([this.#anchorKey]);
		if (!Number.isFinite(this.anchorTs)) {
			this.error = 'This log has an invalid timestamp; surrounding context cannot be loaded.';
			this.initEpoch++;
			return;
		}
		this.loadingInitial = true;
		await Promise.all([this.#loadPage('after'), this.#loadPage('before')]);
		if (thisSeq !== this.#fetchSeq) return;
		this.loadingInitial = false;
		this.initEpoch++;
	}

	async setChips(chips: ContextChip[]): Promise<void> {
		if (this.#abort === null) return; // disposed or not yet initialized
		this.chips = chips;
		await this.init();
	}

	/** Search-page handoff: chip clause + the ±15-minute absolute window centered on the anchor. */
	getSearchHandoff(): { query: string; start: number; end: number } {
		return {
			query: this.#buildChipClause(),
			start: this.anchorTs - WINDOW_SECONDS,
			end: this.anchorTs + WINDOW_SECONDS
		};
	}

	async loadMore(dir: Dir, retry = false): Promise<void> {
		if (this.#abort === null || this.loadingInitial || this.error) return;
		const state = this[dir];
		if (state.loading || state.noMore || state.limited) return;
		if (state.error && !retry) return;
		await this.#loadPage(dir);
	}

	async #loadPage(dir: Dir): Promise<void> {
		const state = this[dir];
		state.loading = true;
		state.error = null;
		const thisSeq = this.#fetchSeq;
		try {
			const result = await searchLogs(this.#request(dir), this.#abort?.signal);
			if (thisSeq !== this.#fetchSeq) return;
			const fresh = this.#toEntries(result.rawHits);
			if (fresh.length > 0) {
				this.entries =
					dir === 'before' ? [...this.entries, ...fresh] : [...fresh.toReversed(), ...this.entries];
			}
			this.#advance(dir, result.rawHits);
		} catch (e) {
			if (isAbortError(e)) return;
			if (thisSeq !== this.#fetchSeq) return;
			state.error = e;
		} finally {
			if (thisSeq === this.#fetchSeq) state.loading = false;
		}
	}

	dispose(): void {
		this.#fetchSeq++;
		this.#abort?.abort();
		this.#abort = null;
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
