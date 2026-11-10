import { isUnfilterable, nameCollator } from '#lib/components/logs/field-names.js';
import { displayNameFor, isOtelAttr, isOtelResourceAttr } from '#lib/utils/fields.js';
import { isPlainObject } from '#lib/utils/object.js';
import type { FieldConfig, Filter } from '#lib/types.js';

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
// What tantivy's query grammar won't read as a field name: a leading `-`, or any of its
// SPECIAL_CHARS. It accepts them backslash-escaped, but composeQuery writes the field as is.
const UNQUERYABLE_PATH = /^-|[\s:()[\]{}'"!+^*`\\]/;

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
