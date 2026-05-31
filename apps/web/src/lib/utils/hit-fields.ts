import type { FieldConfig } from '$lib/types';
import { formatCell } from './column-width';
import { getByPath } from './get-by-path';
import { OTEL_ATTR_PREFIX, OTEL_RESOURCE_ATTR_PREFIX } from './fields';

export interface DrawerField {
	/** Raw dotted path, e.g. "attributes.http.status_code". Used for filtering. */
	name: string;
	/** What FieldRow renders. Equals `name` unless the OTEL prefix was stripped. */
	displayName: string;
	/** Pre-formatted value string. Empty string when there is nothing meaningful to show. */
	value: string;
	/** True when the raw value is null, undefined, an empty string, or an empty object. */
	isEmpty: boolean;
}

export type FieldGroupId = 'attributes' | 'resource_attributes' | 'other' | 'all';

export interface FieldGroup {
	id: FieldGroupId;
	/** Eyebrow label, e.g. "Attributes". `null` ⇒ render with no header (non-OTEL). */
	label: string | null;
	fields: DrawerField[];
}

export interface GroupedHit {
	/** Pre-formatted value of fieldConfig.messageField. May be ''. */
	message: string;
	/** Label for the message block — the actual field name (e.g. "body.message"). */
	messageLabel: string;
	/** Field groups in display order. Empty groups are omitted. */
	groups: FieldGroup[];
}

function leafField(name: string, displayName: string, rawValue: unknown): DrawerField {
	const value = formatCell(rawValue);
	return {
		name,
		displayName,
		value,
		isEmpty: rawValue === null || rawValue === undefined || value === ''
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
function expandValue(
	path: string,
	value: unknown,
	out: DrawerField[],
	toDisplayName: (name: string) => string
): void {
	if (!isPlainObject(value)) {
		out.push(leafField(path, toDisplayName(path), value));
		return;
	}
	const entries = Object.entries(value);
	if (entries.length === 0) {
		out.push({ name: path, displayName: toDisplayName(path), value: '', isEmpty: true });
		return;
	}
	for (const [key, child] of entries) {
		expandValue(`${path}.${key}`, child, out, toDisplayName);
	}
}

const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortByDisplayName(fields: DrawerField[]): DrawerField[] {
	return fields.sort((a, b) => nameCollator.compare(a.displayName, b.displayName));
}

function identity(name: string): string {
	return name;
}

function stripAttrPrefix(name: string): string {
	return name.slice(OTEL_ATTR_PREFIX.length);
}

function stripResourceAttrPrefix(name: string): string {
	return name.slice(OTEL_RESOURCE_ATTR_PREFIX.length);
}

export function groupHitFields(raw: Record<string, unknown>, fieldConfig: FieldConfig): GroupedHit {
	const messageField = fieldConfig.messageField;
	const messageRaw = getByPath(raw, messageField);
	const message = formatCell(messageRaw);

	if (!fieldConfig.isOtel) {
		const fields: DrawerField[] = [];
		for (const [key, value] of Object.entries(raw)) {
			if (isPlainObject(value)) {
				expandValue(key, value, fields, identity);
			} else {
				fields.push(leafField(key, key, value));
			}
		}
		sortByDisplayName(fields);
		return {
			message,
			messageLabel: messageField,
			groups: fields.length > 0 ? [{ id: 'all', label: null, fields }] : []
		};
	}

	const attributes: DrawerField[] = [];
	const resourceAttributes: DrawerField[] = [];
	const other: DrawerField[] = [];

	for (const [key, value] of Object.entries(raw)) {
		if (key === 'attributes' && isPlainObject(value)) {
			expandValue(key, value, attributes, stripAttrPrefix);
		} else if (key === 'resource_attributes' && isPlainObject(value)) {
			expandValue(key, value, resourceAttributes, stripResourceAttrPrefix);
		} else if (isPlainObject(value)) {
			expandValue(key, value, other, identity);
		} else {
			other.push(leafField(key, key, value));
		}
	}

	sortByDisplayName(attributes);
	sortByDisplayName(resourceAttributes);
	sortByDisplayName(other);

	const groups: FieldGroup[] = [];
	if (attributes.length > 0)
		groups.push({ id: 'attributes', label: 'Attributes', fields: attributes });
	if (resourceAttributes.length > 0) {
		groups.push({
			id: 'resource_attributes',
			label: 'Resource Attributes',
			fields: resourceAttributes
		});
	}
	if (other.length > 0) groups.push({ id: 'other', label: 'Other Fields', fields: other });

	return { message, messageLabel: messageField, groups };
}
