import type { IndexField } from '$lib/types';

function inferType(value: unknown): string {
	if (typeof value === 'number') return 'u64';
	if (typeof value === 'boolean') return 'bool';
	return 'text';
}

export function extractJsonSubFields(
	hits: Record<string, unknown>[],
	jsonFieldNames: Set<string>
): IndexField[] {
	const discovered = new Map<string, string>();

	const MAX_DEPTH = 10;

	function walk(obj: unknown, prefix: string, depth = 0) {
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
				walk(value, fullPath, depth + 1);
			} else if (!discovered.has(fullPath)) {
				discovered.set(fullPath, inferType(value));
			}
		}
	}

	for (const hit of hits) {
		for (const fieldName of jsonFieldNames) {
			const value = hit[fieldName];
			if (value !== null && value !== undefined && typeof value === 'object') {
				walk(value, fieldName);
			}
		}
	}

	return Array.from(discovered.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, type]) => ({ name, type, fast: false }));
}
