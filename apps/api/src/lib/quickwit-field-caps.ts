import type { IndexField } from '../types.js';
import { logger } from './logger.js';
import { quickwitUrl } from './quickwit.js';

type FieldCap = { type: string; aggregatable?: boolean };
type FieldCapsBody = { fields?: Record<string, Record<string, FieldCap>> };

const FETCH_TIMEOUT_MS = 10_000;

/** Quickwit 0.9 prefixes dynamically-indexed fields; callers want the document path. */
const DYNAMIC_PREFIX = '_dynamic.';

/** A string leaf is reported as both `keyword` and `text`; the panel wants one row per path. */
function pickType(caps: Record<string, FieldCap>): string | null {
	const types = Object.entries(caps)
		.filter(([, cap]) => cap.aggregatable === true)
		.map(([type]) => type);
	if (types.length === 0) return null;
	return types.includes('keyword') || types.includes('text') ? 'text' : types[0];
}

/**
 * Range-scoped field discovery: the only way to see leaves under a json mapping. `null` on any
 * upstream trouble — the caller degrades to the static schema.
 */
export async function fetchFieldCaps(
	indexId: string,
	range: { startTs: number; endTs: number }
): Promise<IndexField[] | null> {
	const params = new URLSearchParams({
		fields: '*',
		start_timestamp: String(Math.trunc(range.startTs)),
		end_timestamp: String(Math.trunc(range.endTs))
	});
	const url = quickwitUrl(
		`/api/v1/_elastic/${encodeURIComponent(indexId)}/_field_caps?${params.toString()}`
	);

	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as FieldCapsBody;

		const byName = new Map<string, IndexField>();
		for (const [rawName, caps] of Object.entries(body.fields ?? {})) {
			const type = pickType(caps);
			if (type === null) continue;
			const name = rawName.startsWith(DYNAMIC_PREFIX)
				? rawName.slice(DYNAMIC_PREFIX.length)
				: rawName;
			if (name === '' || byName.has(name)) continue;
			// `aggregatable` is the only fast-field signal _field_caps offers.
			byName.set(name, { name, type, fast: true, description: null });
		}

		return [...byName.values()];
	} catch (err) {
		logger.warn({ err, indexId, url }, 'field caps failed — falling back to schema');
		return null;
	}
}
