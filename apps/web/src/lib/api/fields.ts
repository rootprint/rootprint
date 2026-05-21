import { client } from '$lib/api/client';
import type { LoadFieldsFn, LogField } from '$lib/types';
import { displayNameFor } from '$lib/utils/fields';

/**
 * Quickwit synthetic fields that should never appear in the panel.
 * Quickwit emits `_dynamic` when the index uses dynamic mapping; some setups
 * also surface `_source`. Both are noise for the user.
 */
const SYNTHETIC_FIELDS = new Set(['_dynamic', '_source']);

export function createFieldsLoad(): LoadFieldsFn {
  return async (indexId, fieldConfig) => {
    const res = await client.api.indexes[':indexId'].fields.$get({
      param: { indexId },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(body?.error?.message ?? `Failed to load fields (${res.status})`);
    }
    const json = await res.json();

    const hidden = new Set<string>([
      fieldConfig.timestampField,
      fieldConfig.messageField,
      fieldConfig.levelField,
      ...SYNTHETIC_FIELDS,
    ]);

    const fields: LogField[] = json.fields
      .filter((f) => f.fast === true && !hidden.has(f.name))
      .map((f) => ({
        name: f.name,
        displayName: displayNameFor(f.name, fieldConfig.isOtel),
        type: f.type,
      }));

    fields.sort((a, b) => a.name.localeCompare(b.name));
    return fields;
  };
}
