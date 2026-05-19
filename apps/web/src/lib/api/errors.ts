import type { ApiErrorBody } from "api/types";

export function toFieldErrors(body: ApiErrorBody): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of body.error.details ?? []) {
    if (d.path && d.path !== "(root)") out[d.path] = d.message;
  }
  return out;
}
