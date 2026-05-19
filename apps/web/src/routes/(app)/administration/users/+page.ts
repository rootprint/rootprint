import { error } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import type { ApiErrorBody } from "api/types";
import { client } from "$lib/api/client";

export const load: PageLoad = async ({ depends, fetch, parent }) => {
  depends("app:users");
  const { session } = await parent();
  const res = await client.api.users.$get({}, { fetch });
  if (!res.ok) {
    const body = (await res.json()) as ApiErrorBody;
    error(res.status, body.error.message);
  }
  const users = await res.json();
  return {
    users,
    currentUserId: session?.user.id,
  };
};
