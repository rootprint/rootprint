import type { Formatter } from '$lib/types';

function resolveSegments(current: unknown, segments: string[], from: number, to: number): unknown {
	if (from >= to) return current;
	if (current === null || current === undefined || typeof current !== 'object') return undefined;

	const record = current as Record<string, unknown>;
	let key = '';

	for (let i = from; i < to; i++) {
		key = i === from ? segments[i] : `${key}.${segments[i]}`;
		if (key in record) {
			const result = resolveSegments(record[key], segments, i + 1, to);
			if (result !== undefined) return result;
		}
	}

	return undefined;
}

export function resolveFieldValue(hit: Record<string, unknown>, path: string): unknown {
	const segments = path.split('.');
	const direct = resolveSegments(hit, segments, 0, segments.length);
	if (direct !== undefined) return direct;

	if (segments.length < 2) return undefined;

	for (let i = segments.length - 1; i >= 1; i--) {
		const parent = resolveSegments(hit, segments, 0, i);
		if (typeof parent !== 'string') continue;

		let parsed: unknown;
		try {
			parsed = JSON.parse(parent);
		} catch {
			continue;
		}
		if (parsed === null || typeof parsed !== 'object') continue;

		const result = resolveSegments(parsed, segments, i, segments.length);
		if (result !== undefined) return result;
	}

	return undefined;
}

export function formatFieldValue(value: unknown, formatter?: Formatter): string {
	if (formatter) return formatter(value);
	if (value === undefined || value === null) return '';
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value);
}
