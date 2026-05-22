import type { FieldConfig, LogHit } from '$lib/types';

export function normalizeHit(
  raw: Record<string, unknown>,
  index: number,
  fc: FieldConfig
): LogHit {
  return {
    key: String(index),
    timestamp: coerceIso(getByPath(raw, fc.timestampField)),
    level: String(getByPath(raw, fc.levelField) ?? '').toLowerCase(),
    message: String(getByPath(raw, fc.messageField) ?? ''),
    raw,
  };
}

/**
 * Resolve a possibly dotted field name against the raw hit. Tries a direct
 * key lookup first so flat dynamic mappings like { "body.message": "x" }
 * still work, then falls back to walking dot-separated segments through
 * nested objects.
 */
function getByPath(obj: Record<string, unknown>, path: string): unknown {
  if (path in obj) return obj[path];
  const segments = path.split('.');
  let cursor: unknown = obj;
  for (const seg of segments) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

function coerceIso(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    // > 1e15 is physically impossible as milliseconds-since-epoch (year 33658+),
    // so treat values above that as nanoseconds (Quickwit's _otel_timestamp_ns_int).
    const ms = value > 1e15 ? Math.floor(value / 1e6) : value;
    return new Date(ms).toISOString();
  }
  return '';
}
