import type { IndexField } from '$lib/types';

export const OTEL_ATTR_PREFIX = 'attributes.';
export const OTEL_RESOURCE_ATTR_PREFIX = 'resource_attributes.';

export function isOtelAttr(name: string): boolean {
	return name.startsWith(OTEL_ATTR_PREFIX);
}

export function isOtelResourceAttr(name: string): boolean {
	return name.startsWith(OTEL_RESOURCE_ATTR_PREFIX);
}

export function otelDisplayName(name: string): string {
	if (isOtelResourceAttr(name)) return name.slice(OTEL_RESOURCE_ATTR_PREFIX.length);
	if (isOtelAttr(name)) return name.slice(OTEL_ATTR_PREFIX.length);
	return name;
}

function inferType(value: unknown): string {
	if (typeof value === 'number') return 'u64';
	if (typeof value === 'boolean') return 'bool';
	return 'text';
}

export function extractJsonSubFields(
	hits: Record<string, unknown>[],
	jsonFields: Map<string, boolean>
): IndexField[] {
	const discovered = new Map<string, { type: string; fast: boolean }>();

	const MAX_DEPTH = 10;

	function walk(obj: unknown, prefix: string, fast: boolean, depth = 0) {
		if (depth > MAX_DEPTH) return;
		if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) return;
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const fullPath = `${prefix}.${key}`;
			if (
				value !== null &&
				value !== undefined &&
				typeof value === 'object' &&
				!Array.isArray(value)
			) {
				walk(value, fullPath, fast, depth + 1);
			} else if (!discovered.has(fullPath)) {
				discovered.set(fullPath, { type: inferType(value), fast });
			}
		}
	}

	for (const hit of hits) {
		for (const [fieldName, fast] of jsonFields) {
			const value = hit[fieldName];
			if (value !== null && value !== undefined && typeof value === 'object') {
				walk(value, fieldName, fast);
			}
		}
	}

	return Array.from(discovered.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, { type, fast }]) => ({ name, type, fast }));
}
