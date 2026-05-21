import type { TimeRange } from '$lib/types';

export const OTEL_ATTR_PREFIX = 'attributes.';
export const OTEL_RESOURCE_ATTR_PREFIX = 'resource_attributes.';

export function isOtelAttr(name: string): boolean {
  return name.startsWith(OTEL_ATTR_PREFIX);
}

export function isOtelResourceAttr(name: string): boolean {
  return name.startsWith(OTEL_RESOURCE_ATTR_PREFIX);
}

/**
 * For OTel indexes, strip the `attributes.` / `resource_attributes.` prefix so
 * the panel shows the bare name. For non-OTel indexes, the display name equals
 * the raw name.
 */
export function displayNameFor(name: string, isOtelIndex: boolean): string {
  if (!isOtelIndex) return name;
  if (name.startsWith(OTEL_ATTR_PREFIX)) return name.slice(OTEL_ATTR_PREFIX.length);
  if (name.startsWith(OTEL_RESOURCE_ATTR_PREFIX)) return name.slice(OTEL_RESOURCE_ATTR_PREFIX.length);
  return name;
}

/**
 * Stable string key for a time range. Used as part of the FieldRow cache key
 * so that changing the time window refetches values.
 */
export function serializeTimeRange(range: TimeRange): string {
  return range.type === 'relative' ? `r:${range.preset}` : `a:${range.start}-${range.end}`;
}
