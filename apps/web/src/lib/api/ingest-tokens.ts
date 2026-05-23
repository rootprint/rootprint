import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { ApiError, readApiError } from '$lib/api/errors';
import type { CreateIngestTokenInput } from 'api/schemas';

export type IngestTokenView = InferResponseType<
  (typeof client.api)['ingest-tokens']['$get'],
  200
>[number];

export { ApiError as IngestTokenApiError };

export async function listIngestTokens(): Promise<IngestTokenView[]> {
  const res = await client.api['ingest-tokens'].$get({});
  if (!res.ok) throw await readApiError(res, 'Failed to load ingest tokens');
  return res.json() as Promise<IngestTokenView[]>;
}

export async function getIngestToken(id: number): Promise<{ token: string }> {
  const res = await client.api['ingest-tokens'][':id'].$get({ param: { id: String(id) } });
  if (!res.ok) throw await readApiError(res, 'Failed to load token');
  return res.json() as Promise<{ token: string }>;
}

export async function createIngestToken(
  input: CreateIngestTokenInput
): Promise<{ token: string }> {
  const res = await client.api['ingest-tokens'].$post({ json: input });
  if (!res.ok) throw await readApiError(res, 'Failed to create ingest token');
  return res.json() as Promise<{ token: string }>;
}

export async function deleteIngestToken(id: number): Promise<void> {
  const res = await client.api['ingest-tokens'][':id'].$delete({ param: { id: String(id) } });
  if (!res.ok) throw await readApiError(res, 'Failed to delete ingest token');
}
