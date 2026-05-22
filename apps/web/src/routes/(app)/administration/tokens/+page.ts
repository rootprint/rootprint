import type { PageLoad } from './$types';
import { listIngestTokens } from '$lib/api/ingest-tokens';
import { listIndexes } from '$lib/api/indexes';

export const load: PageLoad = async ({ depends }) => {
  depends('app:tokens');
  const [tokens, indexes] = await Promise.all([listIngestTokens(), listIndexes()]);
  return {
    tokens,
    indexIds: indexes.map((i) => i.indexId),
  };
};
