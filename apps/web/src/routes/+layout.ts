import { error, redirect } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { client } from "$lib/api/client";
import { authClient } from "$lib/auth-client";
import type { ApiErrorBody } from "api/types";

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ url, depends }) => {
  depends("app:session");

  const [bootstrapRes, sessionRes] = await Promise.all([
    client.api.auth.bootstrap.$get(),
    authClient.getSession(),
  ]);

  if (!bootstrapRes.ok) {
    const body = (await bootstrapRes.json()) as ApiErrorBody;
    error(bootstrapRes.status, body.error.message);
  }
  const bootstrap = await bootstrapRes.json();
  const session = sessionRes?.data ?? null;

  const isOnSetupAdmin = url.pathname.startsWith("/auth/setup-admin");
  if (bootstrap.needsSetupAdmin && !isOnSetupAdmin) {
    throw redirect(303, "/auth/setup-admin");
  }
  if (!bootstrap.needsSetupAdmin && isOnSetupAdmin) {
    throw redirect(303, "/auth/sign-in");
  }

  return { bootstrap, session };
};
