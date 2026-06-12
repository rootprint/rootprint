type OperationObject = { description?: string; summary?: string; tags?: string[] };
type PathItemObject = Record<string, unknown>;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function authTag(path: string): string {
	if (path.startsWith('/api/auth/api-key/')) return 'Personal API keys';
	if (path.startsWith('/api/auth/admin/')) return 'Auth administration';
	return 'Authentication';
}

function fallbackSummary(path: string): string {
	const words = path
		.replace(/^\/api\/auth\//, '')
		.replace(/[{}]/g, '')
		.split(/[/-]/)
		.filter(Boolean);

	return words
		.map((word, index) => (index === 0 ? `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}` : word))
		.join(' ');
}

export function decorateAuthPaths<T extends Record<string, PathItemObject>>(paths: T): T {
	for (const [path, item] of Object.entries(paths)) {
		for (const method of HTTP_METHODS) {
			const op = item[method] as OperationObject | undefined;
			if (!op) continue;

			op.summary ||= op.description || fallbackSummary(path);
			op.tags = [authTag(path)];
		}
	}

	return paths;
}
