import { isQueryableField } from 'api/query';
import type { FieldConfig } from '#lib/types.js';

export const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base' });

// A raw-tokenized value of 255 bytes or more is one token Quickwit drops, so it can never match.
// ponytail: tokenized fields get the limit too, though a long phrase matches on one that records
// positions; telling them apart needs each field's tokenizer and record in the view config.
const MAX_TERM_BYTES = 254;
const utf8 = new TextEncoder();

/** Whether a `path = raw` filter can match anything. False under an unfilterable json parent too. */
export function canFilter(
	path: string,
	raw: unknown,
	config: FieldConfig
): raw is string | number | boolean {
	// A filter rides the URL as `field:value`, split at the first colon (decodeFilter).
	if (path.includes(':') || !isQueryableField(path)) return false;
	if (config.unfilterableFields.some((f) => path === f || path.startsWith(`${f}.`))) return false;
	if (typeof raw === 'number' || typeof raw === 'boolean') return true;
	return typeof raw === 'string' && raw !== '' && utf8.encode(raw).length <= MAX_TERM_BYTES;
}
