import type { FieldConfig } from '$lib/types';
import { formatCell } from './column-width';
import { getByPath } from './get-by-path';

export interface DrawerField {
  /** Raw dotted path, e.g. "resource_attributes.host.name". */
  name: string;
  /** Pre-formatted value string. Empty string when there is nothing meaningful to show. */
  value: string;
  /** True when the raw value is null, undefined, an empty string, or an empty object. */
  isEmpty: boolean;
}

export interface GroupedHit {
  /** Pre-formatted value of fieldConfig.messageField. May be ''. */
  message: string;
  /** Label for the message block — the actual field name (e.g. "body.message"). */
  messageLabel: string;
  /** Every field present in the hit, alphabetised by name. */
  fields: DrawerField[];
}

function leafField(name: string, rawValue: unknown): DrawerField {
  const value = formatCell(rawValue);
  return {
    name,
    value,
    isEmpty: rawValue === null || rawValue === undefined || value === '',
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Walks object-typed values (Quickwit `json` fields) and emits one row per leaf,
 * with the path joined by dots (e.g. `resource_attributes.telemetry.sdk.language`).
 * Arrays and primitives are treated as leaves; empty objects collapse to an
 * empty leaf so the filter buttons stay hidden.
 */
function expandValue(path: string, value: unknown, out: DrawerField[]): void {
  if (!isPlainObject(value)) {
    out.push(leafField(path, value));
    return;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    out.push({ name: path, value: '', isEmpty: true });
    return;
  }
  for (const [key, child] of entries) {
    expandValue(`${path}.${key}`, child, out);
  }
}

const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

export function groupHitFields(
  raw: Record<string, unknown>,
  fieldConfig: FieldConfig,
): GroupedHit {
  const messageField = fieldConfig.messageField;
  const messageRaw = getByPath(raw, messageField);
  const message = formatCell(messageRaw);

  const fields: DrawerField[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (isPlainObject(value)) {
      expandValue(key, value, fields);
    } else {
      fields.push(leafField(key, value));
    }
  }
  fields.sort((a, b) => nameCollator.compare(a.name, b.name));

  return {
    message,
    messageLabel: messageField,
    fields,
  };
}
