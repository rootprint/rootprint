import { isUnfilterable, nameCollator } from '#lib/components/logs/field-names.js';
import { displayNameFor, isOtelAttr, isOtelResourceAttr } from '#lib/utils/fields.js';
import { isPlainObject } from '#lib/utils/object.js';
import type { FieldConfig, Filter } from '#lib/types.js';

export type ContextScope =
	'all' | 'service' | 'instance' | 'pod' | 'node' | 'container' | 'host' | 'custom';
type Preset = Exclude<ContextScope, 'all' | 'custom'>;

/** A `field = value` the anchor log offers to match on. */
export interface ScopePill {
	field: string;
	label: string;
	value: string | number | boolean;
}

interface PresetRule {
	/** The preset matches on the first of these the anchor has, and is offered only when it has one. */
	oneOf: readonly string[];
	and?: readonly string[];
	/** Not offered when this preset is, because that one already is this thing. */
	hiddenBy?: Preset;
}

// Key order is the bar order.
const PRESET_RULES: Record<Preset, PresetRule> = {
	service: { oneOf: ['service_name'] },
	// The finest scope where there is no pod: a function instance, a task, a dyno, a process on a VM.
	// In Kubernetes it either repeats Pod or ends at every restart. Unique only within a service.
	instance: {
		oneOf: [
			'resource_attributes.service.instance.id',
			'resource_attributes.faas.instance',
			'resource_attributes.aws.ecs.task.arn'
		],
		and: ['service_name'],
		hiddenBy: 'pod'
	},
	pod: {
		oneOf: ['resource_attributes.k8s.pod.name'],
		and: ['resource_attributes.k8s.namespace.name']
	},
	node: { oneOf: ['resource_attributes.k8s.node.name'] },
	// The id first: SDKs set it for their own container, while almost nothing sets the name.
	container: {
		oneOf: ['resource_attributes.container.id', 'resource_attributes.container.name'],
		hiddenBy: 'pod'
	},
	// A collector overwrites host.name with its own host by default, so this can be wider than the
	// app's machine. `attributes.hostname` is the syslog receiver's, the bare names a custom index's.
	host: {
		oneOf: ['resource_attributes.host.name', 'attributes.hostname', 'hostname', 'host'],
		hiddenBy: 'node'
	}
};
const PRESETS = Object.keys(PRESET_RULES) as Preset[];
// Host is last: it is the one most likely to match more than the emitter.
const DEFAULT_ORDER: readonly Preset[] = ['service', 'pod', 'container', 'host'];

// What SDKs and Quickwit write for a missing service name. Matching it joins every unlabelled log.
const UNKNOWN_SERVICE = /^unknown_service(:|$)/;

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

function presetFields(preset: Preset, pills: readonly ScopePill[]): string[] {
	const find = (field: string) => pills.find((p) => p.field === field);
	const { oneOf, and = [], hiddenBy } = PRESET_RULES[preset];
	const first = oneOf.map(find).find((p) => p !== undefined);
	if (!first || (hiddenBy && presetFields(hiddenBy, pills).length > 0)) return [];
	if (preset === 'service' && UNKNOWN_SERVICE.test(String(first.value))) return [];
	return [first.field, ...and];
}

export function availableScopes(pills: readonly ScopePill[]): ContextScope[] {
	return ['all', ...PRESETS.filter((p) => presetFields(p, pills).length > 0), 'custom'];
}

export function resolveScope(
	scope: ContextScope,
	available: readonly ContextScope[]
): ContextScope {
	if (available.includes(scope)) return scope;
	return DEFAULT_ORDER.find((s) => available.includes(s)) ?? 'all';
}

export function scopeMatches(
	pills: readonly ScopePill[],
	scope: ContextScope,
	customFields: readonly string[]
): ScopePill[] {
	if (scope === 'all') return [];
	const fields = scope === 'custom' ? customFields : presetFields(scope, pills);
	return pills.filter((p) => fields.includes(p.field));
}

export function scopeFilters(matches: readonly ScopePill[]): Filter[] {
	return matches.map((p) => ({ field: p.field, value: String(p.value), exclude: false }));
}
