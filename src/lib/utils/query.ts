export function escapeFilterValue(value: string): string {
	if (/[\s:()[\]{}!+\-~^"\\*?/&|]/.test(value)) {
		return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
	}
	return value;
}

/**
 * Build a Lucene filter clause from active quick filters.
 * E.g. { level: ["error", "warn"], service: ["api"] }
 * → '(level:error OR level:warn) AND service:api'
 */
function buildFilterClause(filters: Record<string, string[]>): string {
	const clauses: string[] = [];
	for (const [field, values] of Object.entries(filters)) {
		if (!values.length) continue;
		if (values.length === 1) {
			clauses.push(`${field}:${escapeFilterValue(values[0])}`);
		} else {
			clauses.push(`(${values.map((v) => `${field}:${escapeFilterValue(v)}`).join(' OR ')})`);
		}
	}
	return clauses.join(' AND ');
}

/**
 * Combine a base query with filter clauses.
 * If base is empty or '*', just returns the filter clause (or '*' if no filters).
 */
export function combineQueryWithFilters(
	baseQuery: string,
	filters: Record<string, string[]>
): string {
	const filterClause = buildFilterClause(filters);
	const base = baseQuery.trim();

	if (!filterClause) return base || '*';
	if (!base || base === '*') return filterClause;
	return `${base} AND ${filterClause}`;
}
