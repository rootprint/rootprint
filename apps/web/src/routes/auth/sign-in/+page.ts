import type { PageLoad } from "./$types";
import { client } from "$lib/api/client";
import type { AuthProvidersInfo } from "api/types";

export const load: PageLoad = async () => {
  const providers = await client.api.auth.providers
    .$get()
    .then((res) => (res.ok ? (res.json() as Promise<AuthProvidersInfo>) : null))
    .catch(() => null);

  return {
    providers: providers ?? { google: { enabled: false } },
  };
};
