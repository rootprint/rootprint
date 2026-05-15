import type { PageLoad } from "./$types";

import { api } from "$lib/api/client";
import { ApiError, call } from "$lib/api/call";

export const load: PageLoad = async ({ url, fetch }) => {
  const token = url.searchParams.get("token") ?? "";
  if (!token) {
    return { tokenStatus: "invalid" as const, token: "", email: "" };
  }
  try {
    const { email } = await call(
      api.api.auth["verify-invite"].$post({ json: { token } }, { fetch }),
    );
    return { tokenStatus: "valid" as const, token, email };
  } catch (err) {
    const message = err instanceof ApiError ? err.message.toLowerCase() : "";
    const expired = message.includes("expire");
    return {
      tokenStatus: expired ? ("expired" as const) : ("invalid" as const),
      token,
      email: "",
    };
  }
};
