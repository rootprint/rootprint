import { error } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

import type { ApiErrorBody } from "api/types";
import { client } from "$lib/api/client";

export const load: PageLoad = async ({ depends, fetch }) => {
  depends("app:authentication-google");
  const res = await client.api.settings.auth.google.$get({}, { fetch });
  if (!res.ok) {
    const body = (await res.json()) as ApiErrorBody;
    error(res.status, body.error.message);
  }
  const settings = await res.json();
  return {
    settings,
    origin: typeof window === "undefined" ? "" : window.location.origin,
  };
};
