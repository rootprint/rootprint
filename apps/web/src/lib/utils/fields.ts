import type { TimeRange } from '$lib/types';
import { isPlainObject } from './object';

export const OTEL_ATTR_PREFIX = 'attributes.';
export const OTEL_RESOURCE_ATTR_PREFIX = 'resource_attributes.';

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

const JSON_SUBFIELD_MAX_DEPTH = 10;

export function extractJsonSubFields(
	hits: ReadonlyArray<Record<string, unknown>>,
	jsonFieldNames: ReadonlyArray<string>
): Set<string> {
	const discovered = new Set<string>();
	if (jsonFieldNames.length === 0 || hits.length === 0) return discovered;

	function walk(obj: unknown, prefix: string, depth: number): void {
		if (depth > JSON_SUBFIELD_MAX_DEPTH) return;
		if (!isPlainObject(obj)) return;
		for (const [key, value] of Object.entries(obj)) {
			const fullPath = `${prefix}.${key}`;
			if (isPlainObject(value)) {
				walk(value, fullPath, depth + 1);
			} else {
				discovered.add(fullPath);
			}
		}
	}

	for (const hit of hits) {
		for (const name of jsonFieldNames) {
			const value = hit[name];
			if (isPlainObject(value)) {
				walk(value, name, 0);
			}
		}
	}

	return discovered;
}
