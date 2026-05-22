import { client } from '$lib/api/client';
import type { Preferences } from 'api/types';

async function readApiError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  return new Error(body?.error?.message ?? `${fallback} (${res.status})`);
}

export async function getPreferences(indexId: string): Promise<Preferences> {
  const res = await client.api.indexes[':indexId'].preferences.$get({
    param: { indexId },
  });
  if (!res.ok) throw await readApiError(res, 'Failed to load column preferences');
  return res.json() as Promise<Preferences>;
}

export async function setPreferences(
  indexId: string,
  displayFields: string[] | null
): Promise<Preferences> {
  const res = await client.api.indexes[':indexId'].preferences.$put({
    param: { indexId },
    json: { displayFields },
  });
  if (!res.ok) throw await readApiError(res, 'Failed to save column preferences');
  return res.json() as Promise<Preferences>;
}
