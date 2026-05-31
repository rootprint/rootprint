import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { FieldConfig, LogField } from '$lib/types';
import { displayNameFor } from '$lib/utils/fields';

/** Quickwit synthetic fields (`_dynamic` from dynamic mapping, `_source`) — noise, hide from the panel. */
const SYNTHETIC_FIELDS = new Set(['_dynamic', '_source']);

export async function loadFields(indexId: string, fieldConfig: FieldConfig): Promise<LogField[]> {
	const res = await client.api.indexes[':indexId'].fields.$get({
		param: { indexId }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load fields');
	const json = await res.json();

	const hidden = new Set<string>([
		fieldConfig.timestampField,
		fieldConfig.messageField,
		fieldConfig.levelField,
		...SYNTHETIC_FIELDS
	]);

	const fields: LogField[] = json.fields
		.filter((f) => (f.fast === true || f.type === 'json') && !hidden.has(f.name))
		.map((f) => ({
			name: f.name,
			displayName: displayNameFor(f.name, fieldConfig.isOtel),
			type: f.type
		}));

	return fields;
}
