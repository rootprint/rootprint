import type { PageLoad } from "./$types";

import { api } from "$lib/api/client";
import { call } from "$lib/api/call";

export const load: PageLoad = async ({ depends, fetch }) => {
  depends("app:tokens");
  const [tokens, indexes] = await Promise.all([
    call(api.api["ingest-tokens"].$get({}, { fetch })),
    call(api.api.indexes.$get({}, { fetch })),
  ]);
  return {
    tokens,
    indexIds: indexes.map((i) => i.indexId),
  };
};
