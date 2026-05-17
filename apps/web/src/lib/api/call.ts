import type { ClientResponse } from "hono/client";
import type { SuccessStatusCode } from "hono/utils/http-status";
import type { ApiErrorBody } from "api/types";

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Hono RPC types responses as a union (one ClientResponse per status code).
// Extract the success branches so callers see the success payload type.
type SuccessBody<R> = R extends ClientResponse<infer T, infer S, infer _F>
  ? S extends SuccessStatusCode
    ? S extends 204
      ? undefined
      : T
    : never
  : never;

export async function call<R extends ClientResponse<unknown, number, string>>(
  req: Promise<R>,
): Promise<SuccessBody<R>> {
  const res = await req;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const fieldErrors: Record<string, string> = {};
    for (const d of body?.error?.details ?? []) {
      if (d.path && d.path !== "(root)") fieldErrors[d.path] = d.message;
    }
    throw new ApiError(
      body?.error?.message ?? `Request failed (${res.status})`,
      res.status,
      fieldErrors,
    );
  }
  if (res.status === 204) return undefined as SuccessBody<R>;
  return (await res.json()) as SuccessBody<R>;
}
