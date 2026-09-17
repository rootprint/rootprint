import type { TimeRange } from '$lib/types';
import { isPlainObject } from './object';

const OTEL_ATTR_PREFIX = 'attributes.';
const OTEL_RESOURCE_ATTR_PREFIX = 'resource_attributes.';

export function isOtelAttr(name: string): boolean {
	return name.startsWith(OTEL_ATTR_PREFIX);
}

export function isOtelResourceAttr(name: string): boolean {
	return name.startsWith(OTEL_RESOURCE_ATTR_PREFIX);
}

/** Strip the leading `attributes.` / `resource_attributes.` prefix when present. */
export function stripOtelPrefix(name: string): string {
	if (name.startsWith(OTEL_ATTR_PREFIX)) return name.slice(OTEL_ATTR_PREFIX.length);
	if (name.startsWith(OTEL_RESOURCE_ATTR_PREFIX))
		return name.slice(OTEL_RESOURCE_ATTR_PREFIX.length);
	return name;
}

/** For OTel indexes, strip the `attributes.` / `resource_attributes.` prefix; otherwise return the raw name. */
export function displayNameFor(name: string, isOtelIndex: boolean): string {
	return isOtelIndex ? stripOtelPrefix(name) : name;
}

/**
 * Stable string key for a time range. Used as part of the FieldRow cache key
 * so that changing the time window refetches values.
 */
export function serializeTimeRange(range: TimeRange): string {
	return range.type === 'relative' ? `r:${range.preset}` : `a:${range.start}-${range.end}`;
}

/** Leaf path -> how many of the sampled hits carry it, plus the size of that sample. */
export type FieldSample = { counts: ReadonlyMap<string, number>; total: number };

function collect(value: unknown, path: string, seen: Set<string>): void {
	// Arrays are transparent: Quickwit flattens them, so an array of objects indexes leaves here.
	if (Array.isArray(value)) {
		for (const item of value) collect(item, path, seen);
		return;
	}
	if (isPlainObject(value)) {
		for (const [key, child] of Object.entries(value)) {
			collect(child, path === '' ? key : `${path}.${key}`, seen);
		}
		return;
	}
	seen.add(path);
}

/**
 * Every leaf path the given hits carry, top-level columns and JSON leaves alike, with how many of
 * them carry it. Covers leaves too fresh for `_field_caps`, which answers per published split.
 */
export function countFieldPaths(hits: ReadonlyArray<Record<string, unknown>>): FieldSample {
	const counts = new Map<string, number>();

	for (const hit of hits) {
		// Deduplicated per hit, so a 20-element array does not count its leaves 20 times.
		const seen = new Set<string>();
		collect(hit, '', seen);
		for (const path of seen) counts.set(path, (counts.get(path) ?? 0) + 1);
	}

	return { counts, total: hits.length };
}
