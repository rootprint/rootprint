export function getByPath(obj: unknown, path: string): unknown {
	if (obj === null || typeof obj !== 'object') return undefined;
	const record = obj as Record<string, unknown>;
	if (path in record) return record[path];
	for (let dot = path.indexOf('.'); dot !== -1; dot = path.indexOf('.', dot + 1)) {
		const head = path.slice(0, dot);
		if (head in record) {
			const result = getByPath(record[head], path.slice(dot + 1));
			if (result !== undefined) return result;
		}
	}
	return undefined;
}
