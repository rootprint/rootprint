const MAX_DEPTH = 8;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Recursively rewrites `value`, replacing any string whose trimmed content is a
 * JSON object or array with its parsed form. Scalar-looking strings ("40926",
 * "true", "prod") are left untouched so they are not coerced to other types.
 * Recursion is capped at MAX_DEPTH to defend against pathological input; parse
 * failures are silent (the original string is kept).
 */
export function resolveEmbeddedJson(value: unknown, depth = 0): unknown {
	if (depth >= MAX_DEPTH) return value;

	if (typeof value === 'string') {
		const trimmed = value.trimStart();
		const first = trimmed[0];
		if (first !== '{' && first !== '[') return value;
		try {
			const parsed: unknown = JSON.parse(trimmed);
			// JSON.parse can yield scalars; only descend when genuinely structured.
			if (isPlainObject(parsed) || Array.isArray(parsed)) {
				return resolveEmbeddedJson(parsed, depth + 1);
			}
			return value;
		} catch {
			return value;
		}
	}

	if (Array.isArray(value)) {
		return value.map((el) => resolveEmbeddedJson(el, depth + 1));
	}

	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {};
		for (const [key, child] of Object.entries(value)) {
			out[key] = resolveEmbeddedJson(child, depth + 1);
		}
		return out;
	}

	return value;
}
