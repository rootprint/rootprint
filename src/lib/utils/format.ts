export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	let current: unknown = obj;
	for (const key of path.split('.')) {
		if (current === null || current === undefined || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
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
