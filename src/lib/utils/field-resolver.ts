import type { Formatter } from '$lib/types';

function resolveSegments(current: unknown, segments: string[]): unknown {
	if (segments.length === 0) return current;
	if (current === null || current === undefined || typeof current !== 'object') return undefined;

	const record = current as Record<string, unknown>;

	for (let i = 1; i <= segments.length; i++) {
		const key = segments.slice(0, i).join('.');
		if (key in record) {
			const result = resolveSegments(record[key], segments.slice(i));
			if (result !== undefined) return result;
		}
	}

	return undefined;
}

function resolve(obj: Record<string, unknown>, path: string): unknown {
	return resolveSegments(obj, path.split('.'));
}

export function resolveFieldValue(hit: Record<string, unknown>, path: string): unknown | undefined {
	// Try direct resolve first
	const direct = resolve(hit, path);
	if (direct !== undefined) return direct;

	// Try JSON-in-string fallback at each split point
	if (path.includes('.')) {
		const segments = path.split('.');
		for (let i = segments.length - 1; i >= 1; i--) {
			const parentPath = segments.slice(0, i).join('.');
			const subPath = segments.slice(i).join('.');
			const parentValue = resolve(hit, parentPath);
			if (typeof parentValue === 'string') {
				let parsed: unknown;
				try {
					parsed = JSON.parse(parentValue);
				} catch {
					continue;
				}
				if (parsed !== null && typeof parsed === 'object') {
					const result = resolveSegments(parsed, subPath.split('.'));
					if (result !== undefined) return result;
				}
			}
		}
	}

	return undefined;
}

export function formatFieldValue(value: unknown, formatter?: Formatter): string {
	if (formatter) return formatter(value);
	if (value === undefined || value === null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}
