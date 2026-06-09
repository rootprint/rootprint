import { getUnixTime, isValid, parseISO } from 'date-fns';

import { searchLogs } from '$lib/api/log-search';
import { getByPath } from '$lib/utils/get-by-path';
import { escapeFilterValue } from 'api/query';
import { normalizeHit } from '$lib/utils/normalize-hit';
import type { ContextChip, ContextEntry, FieldConfig, LogHit } from '$lib/types';

const PAGE_SIZE = 200;
const WINDOW_HALF_SECONDS = 15 * 60;
const WINDOW_SECONDS = 15 * 60;
/** After this many consecutive fully-empty slides in one direction, stop walking. */
const MAX_EMPTY_SLIDES = 3;

function seedChipsFromIndex(
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
	entries = $state<ContextEntry[]>([]);

	loadingInitial = $state(false);
	loadingMoreBefore = $state(false);
	loadingMoreAfter = $state(false);
	noMoreBefore = $state(false);
	noMoreAfter = $state(false);
	error = $state<string | null>(null);
	/** Bumps every time an initial fetch completes successfully. Pane watches this to scroll to the anchor row. */
	initEpoch = $state(0);

	// Sliding-window pagination: each direction owns a 15-min slice + offset that slides outward (resetting offset) once a slice returns < PAGE_SIZE rows, letting Quickwit prune to one time partition per request.
	#beforeWindowEnd = 0; // upper bound of the current 'before' slice (seconds)
	#beforeOffset = 0;
	#beforeEmptySlides = 0;
	#afterWindowStart = 0; // lower bound of the current 'after' slice (seconds)
	#afterOffset = 0;
	#afterEmptySlides = 0;
	#seenKeys = new Set<string>();
	#abort: AbortController | null = null;
	#fetchSeq = 0;
	#nextEntryKey = 0;
	readonly #anchorKey: string;

	constructor(anchor: LogHit, indexId: string, fieldConfig: FieldConfig) {
		this.anchor = anchor;
		this.indexId = indexId;
		this.fieldConfig = fieldConfig;
		// anchor.timestamp is ISO; convert to seconds for Quickwit time bounds.
		// NaN when the timestamp is missing/unparseable — #fetchInitial bails out then.
		const parsed = parseISO(anchor.timestamp);
		this.anchorTs = isValid(parsed) ? getUnixTime(parsed) : NaN;
		this.#beforeWindowEnd = this.anchorTs;
		this.#afterWindowStart = this.anchorTs;
		this.#anchorKey = hitKey(anchor.raw);
		this.chips = seedChipsFromIndex(anchor.raw, fieldConfig.contextFields);
	}

	/** Post-page bookkeeping for the 'after' direction, given the pre-dedup row count: full page bumps offset; partial slides the slice outward; empty slides count toward MAX_EMPTY_SLIDES before declaring noMore. */
	#advanceAfter(rowCount: number): void {
		if (rowCount >= PAGE_SIZE) {
			this.#afterOffset += PAGE_SIZE;
			this.#afterEmptySlides = 0;
			return;
		}
		this.#afterWindowStart += WINDOW_SECONDS;
		this.#afterOffset = 0;
		if (rowCount === 0) {
			this.#afterEmptySlides += 1;
			if (this.#afterEmptySlides >= MAX_EMPTY_SLIDES) this.noMoreAfter = true;
		} else {
			this.#afterEmptySlides = 0;
		}
	}

	#advanceBefore(rowCount: number): void {
		if (rowCount >= PAGE_SIZE) {
			this.#beforeOffset += PAGE_SIZE;
			this.#beforeEmptySlides = 0;
			return;
		}
		this.#beforeWindowEnd -= WINDOW_SECONDS;
		this.#beforeOffset = 0;
		if (rowCount === 0) {
			this.#beforeEmptySlides += 1;
			if (this.#beforeEmptySlides >= MAX_EMPTY_SLIDES) this.noMoreBefore = true;
		} else {
			this.#beforeEmptySlides = 0;
		}
	}

	/** AND-joined chip query used by internal fetches; '*' when no chips. */
	get composedQuery(): string {
		const clause = this.#buildChipClause();
		return clause === '' ? '*' : clause;
	}

	#buildChipClause(): string {
		if (this.chips.length === 0) return '';
		return this.chips.map((c) => `${c.field}:${escapeFilterValue(String(c.value))}`).join(' AND ');
	}

	async init(): Promise<void> {
		await this.#fetchInitial();
	}

	async removeChip(field: string): Promise<void> {
		if (this.#abort === null) return; // disposed
		const next = this.chips.filter((c) => c.field !== field);
		if (next.length === this.chips.length) return;
		this.chips = next;
		await this.#fetchInitial();
	}

	/** Search-page handoff: chip clause + the ±15-minute absolute window centered on the anchor. */
	getSearchHandoff(): { query: string; start: number; end: number } {
		return {
			query: this.#buildChipClause(),
			start: this.anchorTs - WINDOW_HALF_SECONDS,
			end: this.anchorTs + WINDOW_HALF_SECONDS
		};
	}

	async loadMoreBefore(): Promise<void> {
		if (this.#abort === null) return; // disposed
		if (this.loadingMoreBefore || this.noMoreBefore || this.loadingInitial) return;
		this.loadingMoreBefore = true;
		const thisSeq = this.#fetchSeq;
		try {
			const result = await searchLogs(
				{
					indexId: this.indexId,
					query: this.composedQuery,
					limit: PAGE_SIZE,
					offset: this.#beforeOffset,
					sortDirection: 'desc',
					startTimestamp: this.#beforeWindowEnd - WINDOW_SECONDS,
					endTimestamp: this.#beforeWindowEnd
				},
				{ signal: this.#abort?.signal }
			);
			if (thisSeq !== this.#fetchSeq) return;
			const fresh = this.#dedupe(result.rawHits);
			// 'desc' returns newest-first; append at the end of the list (which is also newest-first).
			this.entries = [...this.entries, ...this.#toEntries(fresh)];
			this.#advanceBefore(result.rawHits.length);
		} catch (e) {
			if ((e as { name?: string })?.name === 'AbortError') return;
			// Silent: sentinel stays visible, user re-scrolls to retry.
		} finally {
			// Always clear: a stale-leftover `true` would freeze the trigger after a chip change.
			this.loadingMoreBefore = false;
		}
	}

	async loadMoreAfter(): Promise<void> {
		if (this.#abort === null) return; // disposed
		if (this.loadingMoreAfter || this.noMoreAfter || this.loadingInitial) return;
		this.loadingMoreAfter = true;
		const thisSeq = this.#fetchSeq;
		try {
			const result = await searchLogs(
				{
					indexId: this.indexId,
					query: this.composedQuery,
					limit: PAGE_SIZE,
					offset: this.#afterOffset,
					sortDirection: 'asc',
					startTimestamp: this.#afterWindowStart,
					endTimestamp: this.#afterWindowStart + WINDOW_SECONDS
				},
				{ signal: this.#abort?.signal }
			);
			if (thisSeq !== this.#fetchSeq) return;
			const fresh = this.#dedupe(result.rawHits);
			// 'asc' returns oldest-first; reverse so newest-first, then prepend to the list.
			this.entries = [...this.#toEntries(fresh.toReversed()), ...this.entries];
			this.#advanceAfter(result.rawHits.length);
		} catch (e) {
			if ((e as { name?: string })?.name === 'AbortError') return;
		} finally {
			this.loadingMoreAfter = false;
		}
	}

	dispose(): void {
		this.#abort?.abort();
		this.#abort = null;
	}

	async #fetchInitial(): Promise<void> {
		if (!Number.isFinite(this.anchorTs)) {
			this.error = 'This log has an invalid timestamp; surrounding context cannot be loaded.';
			this.entries = [this.#toEntry(this.anchor.raw, true)];
			this.noMoreBefore = true;
			this.noMoreAfter = true;
			this.initEpoch++;
			return;
		}
		this.#abort?.abort();
		this.#abort = new AbortController();
		const thisSeq = ++this.#fetchSeq;
		this.loadingInitial = true;
		this.error = null;
		this.entries = [];
		this.#seenKeys = new Set<string>([this.#anchorKey]);
		this.#beforeWindowEnd = this.anchorTs;
		this.#beforeOffset = 0;
		this.#beforeEmptySlides = 0;
		this.#afterWindowStart = this.anchorTs;
		this.#afterOffset = 0;
		this.#afterEmptySlides = 0;
		this.noMoreBefore = false;
		this.noMoreAfter = false;
		// Clear any leftover load-more flags from an aborted previous round.
		this.loadingMoreBefore = false;
		this.loadingMoreAfter = false;

		try {
			const [afterRes, beforeRes] = await Promise.all([
				searchLogs(
					{
						indexId: this.indexId,
						query: this.composedQuery,
						limit: PAGE_SIZE,
						offset: 0,
						sortDirection: 'asc',
						startTimestamp: this.anchorTs,
						endTimestamp: this.anchorTs + WINDOW_SECONDS
					},
					{ signal: this.#abort.signal }
				),
				searchLogs(
					{
						indexId: this.indexId,
						query: this.composedQuery,
						limit: PAGE_SIZE,
						offset: 0,
						sortDirection: 'desc',
						startTimestamp: this.anchorTs - WINDOW_SECONDS,
						endTimestamp: this.anchorTs
					},
					{ signal: this.#abort.signal }
				)
			]);

			if (thisSeq !== this.#fetchSeq) return;

			const afterFresh = this.#dedupe(afterRes.rawHits);
			const beforeFresh = this.#dedupe(beforeRes.rawHits);

			// Final order: newest first. 'asc' results reversed → newest; anchor in middle; 'desc' results → older.
			const merged: ContextEntry[] = [
				...this.#toEntries(afterFresh.toReversed()),
				this.#toEntry(this.anchor.raw, true),
				...this.#toEntries(beforeFresh)
			];
			this.entries = merged;
			this.initEpoch++;

			this.#advanceAfter(afterRes.rawHits.length);
			this.#advanceBefore(beforeRes.rawHits.length);
		} catch (e) {
			if ((e as { name?: string })?.name === 'AbortError') return;
			if (thisSeq !== this.#fetchSeq) return;
			this.error = 'Failed to fetch log context. Check your connection and try again.';
			this.entries = [this.#toEntry(this.anchor.raw, true)];
			this.initEpoch++;
		} finally {
			if (thisSeq === this.#fetchSeq) this.loadingInitial = false;
		}
	}

	#dedupe(hits: Record<string, unknown>[]): Record<string, unknown>[] {
		const out: Record<string, unknown>[] = [];
		for (const h of hits) {
			const k = hitKey(h);
			if (this.#seenKeys.has(k)) continue;
			this.#seenKeys.add(k);
			out.push(h);
		}
		return out;
	}

	#toEntries(hits: Record<string, unknown>[]): ContextEntry[] {
		return hits.map((h) => this.#toEntry(h, false));
	}

	#toEntry(hit: Record<string, unknown>, isAnchor: boolean): ContextEntry {
		return { ...normalizeHit(hit, this.#nextEntryKey++, this.fieldConfig), isAnchor };
	}
}
