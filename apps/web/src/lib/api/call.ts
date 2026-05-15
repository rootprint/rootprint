import type { ClientResponse } from "hono/client";
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

export async function call<T>(req: Promise<ClientResponse<T>>): Promise<T> {
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
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
