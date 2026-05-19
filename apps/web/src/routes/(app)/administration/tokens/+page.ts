import { error } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import type { ApiErrorBody } from "api/types";
import { client } from "$lib/api/client";

export const load: PageLoad = async ({ depends, fetch }) => {
  depends("app:tokens");
  const [tokensRes, indexesRes] = await Promise.all([
    client.api["ingest-tokens"].$get({}, { fetch }),
    client.api.indexes.$get({}, { fetch }),
  ]);
  if (!tokensRes.ok) {
    const body = (await tokensRes.json()) as ApiErrorBody;
    error(tokensRes.status, body.error.message);
  }
  if (!indexesRes.ok) {
    const body = (await indexesRes.json()) as ApiErrorBody;
    error(indexesRes.status, body.error.message);
  }
  const [tokens, indexes] = await Promise.all([tokensRes.json(), indexesRes.json()]);
  return {
    tokens,
    indexIds: indexes.map((i) => i.indexId),
  };
};
