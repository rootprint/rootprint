import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { FieldConfig, IndexOption } from '$lib/types';
import { client } from '$lib/api/client';
import { createFieldValuesFetch } from '$lib/api/field-values';
import { createFieldsLoad } from '$lib/api/fields';
import { createHistogramFetch } from '$lib/api/histogram';
import { createLogSearch } from '$lib/api/log-search';

export const load = (async ({ fetch }) => {
  const res = await client.api.indexes.$get({}, { fetch });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw error(res.status, body?.error?.message ?? 'Failed to load indexes');
  }
  const summaries = await res.json();

  const indexes: IndexOption[] = summaries.map((s) => ({
    id: s.indexId,
    name: s.displayName ?? s.indexId,
  }));

  const searchFn = createLogSearch();
  const histogramFn = createHistogramFetch();
  const loadFields = createFieldsLoad();
  const fetchValues = createFieldValuesFetch();
  const loadConfig = async (indexId: string): Promise<FieldConfig> => {
    const res = await client.api.indexes[':indexId'].config.$get(
      { param: { indexId } },
      { fetch }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      throw new Error(body?.error?.message ?? `Failed to load index config (${res.status})`);
    }
    const json = await res.json();
    return {
      timestampField: json.timestampField,
      levelField: json.levelField,
      messageField: json.messageField,
      tracebackField: json.tracebackField ?? 'traceback',
      isOtel: json.isOtel,
    };
  };

  return {
    indexes,
    searchFn,
    histogramFn,
    loadConfig,
    loadFields,
    fetchValues,
    timeRangeLabel: 'last 15m',
    history: [] as unknown[],
    savedQueries: [] as unknown[],
    sharedQueries: [] as unknown[],
  };
}) satisfies PageLoad;
