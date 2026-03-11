export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	return resolveSegments(obj, path.split('.'));
}

function resolveSegments(current: unknown, segments: string[]): unknown {
	if (segments.length === 0) return current;
	if (current === null || current === undefined || typeof current !== 'object') return undefined;

	const record = current as Record<string, unknown>;

	// Try progressively longer key combinations to handle keys containing dots
	// e.g. for segments ["resource_attributes", "host", "name"],
	// tries "resource_attributes" first, then "resource_attributes.host", etc.
	for (let i = 1; i <= segments.length; i++) {
		const key = segments.slice(0, i).join('.');
		if (key in record) {
			const result = resolveSegments(record[key], segments.slice(i));
			if (result !== undefined) return result;
		}
	}

	return undefined;
}

export function formatFieldValue(val: unknown): string {
	if (val === undefined || val === null) return '';
	if (typeof val === 'object') return JSON.stringify(val);
	return String(val);
}

export function getUserInitials(name: string | undefined): string {
	if (!name) return '?';
	return name
		.split(' ')
		.map((n) => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}
