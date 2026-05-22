import { client } from '$lib/api/client';
import type { SavedQuery } from 'api/types';

export type SavedQueryCreateInput = {
  name: string;
  description?: string;
  query: string;
};

export type SavedQueryPatch = {
  name?: string;
  description?: string | null;
  query?: string;
};

export class SavedQueryError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'SavedQueryError';
    this.code = code;
  }
}

async function throwFromResponse(res: Response, fallback: string): Promise<never> {
  const body = (await res.json().catch(() => null)) as
    | { error?: { message?: string; code?: string } }
    | null;
  throw new SavedQueryError(
    body?.error?.message ?? `${fallback} (${res.status})`,
    body?.error?.code
  );
}

export async function listSavedQueries(indexId: string): Promise<SavedQuery[]> {
  const res = await client.api.indexes[':indexId']['saved-queries'].$get({
    param: { indexId },
  });
  if (!res.ok) await throwFromResponse(res, 'Failed to load saved queries');
  return (await res.json()) as unknown as SavedQuery[];
}

export async function createSavedQuery(
  indexId: string,
  input: SavedQueryCreateInput
): Promise<SavedQuery> {
  const res = await client.api.indexes[':indexId']['saved-queries'].$post({
    param: { indexId },
    json: input,
  });
  if (!res.ok) await throwFromResponse(res, 'Failed to save query');
  return (await res.json()) as unknown as SavedQuery;
}

export async function updateSavedQuery(
  indexId: string,
  id: number,
  patch: SavedQueryPatch
): Promise<SavedQuery> {
  const res = await client.api.indexes[':indexId']['saved-queries'][':id'].$patch({
    param: { indexId, id: String(id) },
    json: patch,
  });
  if (!res.ok) await throwFromResponse(res, 'Failed to update saved query');
  return (await res.json()) as unknown as SavedQuery;
}

export async function deleteSavedQuery(indexId: string, id: number): Promise<void> {
  const res = await client.api.indexes[':indexId']['saved-queries'][':id'].$delete({
    param: { indexId, id: String(id) },
  });
  if (!res.ok) await throwFromResponse(res, 'Failed to delete saved query');
}
