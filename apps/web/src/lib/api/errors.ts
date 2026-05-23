import type { ApiErrorBody } from "api/types";

export class ApiError extends Error {
  status: number;
  body?: ApiErrorBody;
  code?: string;
  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = body?.error.code;
  }
}

export async function readApiError(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiError(
    body?.error.message ?? `${fallback} (${res.status})`,
    res.status,
    body ?? undefined
  );
}

export function toFieldErrors(body: ApiErrorBody): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of body.error.details ?? []) {
    if (d.path && d.path !== "(root)") out[d.path] = d.message;
  }
  return out;
}
