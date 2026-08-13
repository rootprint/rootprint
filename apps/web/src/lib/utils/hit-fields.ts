import type { FieldConfig, FieldRowData } from '$lib/types';
import { formatCell } from './column-width';
import { getByPath } from './get-by-path';
import { stripOtelPrefix } from './fields';
import { isPlainObject } from './object';

export type FieldGroupId = 'attributes' | 'resource_attributes' | 'other' | 'all';

export interface FieldGroup {
	id: FieldGroupId;
	/** Eyebrow label, e.g. "Attributes". `null` ⇒ render with no header (non-OTEL). */
	label: string | null;
	fields: FieldRowData[];
}

export interface GroupedHit {
	/** Pre-formatted value of fieldConfig.messageField. May be ''. */
	message: string;
	/** Label for the message block — the actual field name (e.g. "body.message"). */
	messageLabel: string;
	/** Field groups in display order. Empty groups are omitted. */
	groups: FieldGroup[];
}

function leafField(name: string, displayName: string, rawValue: unknown): FieldRowData {
	const value = formatCell(rawValue);
	return {
		name,
		displayName,
		value,
		isEmpty: rawValue === null || rawValue === undefined || value === ''
	};
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
	out: FieldRowData[],
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

function sortByDisplayName(fields: FieldRowData[]): FieldRowData[] {
	return fields.toSorted((a, b) => nameCollator.compare(a.displayName, b.displayName));
}

function identity(name: string): string {
	return name;
}

export function groupHitFields(raw: Record<string, unknown>, fieldConfig: FieldConfig): GroupedHit {
	const messageField = fieldConfig.messageField;
	const messageRaw = getByPath(raw, messageField);
	const message = formatCell(messageRaw);

	if (!fieldConfig.isOtel) {
		const collected: FieldRowData[] = [];
		for (const [key, value] of Object.entries(raw)) {
			if (isPlainObject(value)) {
				expandValue(key, value, collected, identity);
			} else {
				collected.push(leafField(key, key, value));
			}
		}
		const fields = sortByDisplayName(collected);
		return {
			message,
			messageLabel: messageField,
			groups: fields.length > 0 ? [{ id: 'all', label: null, fields }] : []
		};
	}

	const rawAttributes: FieldRowData[] = [];
	const rawResourceAttributes: FieldRowData[] = [];
	const rawOther: FieldRowData[] = [];

	for (const [key, value] of Object.entries(raw)) {
		if (key === 'attributes' && isPlainObject(value)) {
			expandValue(key, value, rawAttributes, stripOtelPrefix);
		} else if (key === 'resource_attributes' && isPlainObject(value)) {
			expandValue(key, value, rawResourceAttributes, stripOtelPrefix);
		} else if (isPlainObject(value)) {
			expandValue(key, value, rawOther, identity);
		} else {
			rawOther.push(leafField(key, key, value));
		}
	}

	const attributes = sortByDisplayName(rawAttributes);
	const resourceAttributes = sortByDisplayName(rawResourceAttributes);
	const other = sortByDisplayName(rawOther);

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
