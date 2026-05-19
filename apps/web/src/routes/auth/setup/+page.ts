import type { PageLoad } from "./$types";

import { client } from "$lib/api/client";
import type { ApiErrorBody } from "api/types";

export const load: PageLoad = async ({ url, fetch }) => {
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return { tokenStatus: "invalid" as const, token: "", email: "" };
  }

  const res = await client.api.auth["verify-invite"].$post({ json: { token } }, { fetch });
  if (!res.ok) {
    const body = (await res.json()) as ApiErrorBody;
    const message = body.error.message.toLowerCase();
    const expired = message.includes("expire");
    return {
      tokenStatus: expired ? ("expired" as const) : ("invalid" as const),
      token,
      email: "",
    };
  }
  const { email } = await res.json();
  return { tokenStatus: "valid" as const, token, email };
};
