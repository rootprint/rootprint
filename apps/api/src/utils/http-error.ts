import type { ApiErrorDetail } from '../types.js';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: ApiErrorDetail[]) => new HttpError(400, code, message, details);
export const unauthorized = (message: string, code = 'UNAUTHORIZED') => new HttpError(401, code, message);
export const forbidden = (message: string, code = 'FORBIDDEN') => new HttpError(403, code, message);
export const notFound = (message: string, code = 'NOT_FOUND') => new HttpError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new HttpError(409, code, message);
export const unsupportedMediaType = (message: string, code = 'UNSUPPORTED_MEDIA_TYPE') => new HttpError(415, code, message);
export const unprocessable = (message: string, code = 'UNPROCESSABLE_ENTITY', details?: ApiErrorDetail[]) => new HttpError(422, code, message, details);
export const tooManyRequests = (message: string, code = 'TOO_MANY_REQUESTS') => new HttpError(429, code, message);
export const internal = (message: string, code = 'INTERNAL') => new HttpError(500, code, message);
export const serviceUnavailable = (message: string, code = 'SERVICE_UNAVAILABLE') => new HttpError(503, code, message);

export function indexAccessError(isAdmin: boolean, kind: 'denied' | 'missing'): HttpError {
  if (kind === 'missing' && isAdmin) return notFound('Index not found', 'INDEX_NOT_FOUND');
  return new HttpError(403, 'INDEX_NOT_ACCESSIBLE', 'Index not accessible');
}

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ((err as { code?: unknown }).code === '23505') return true;
  const cause = (err as { cause?: unknown }).cause;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { code?: unknown }).code === '23505'
  );
}

export function fromAuthApiError(err: unknown, fallback: string): HttpError {
  const e = err as { status?: number; body?: { message?: string }; message?: string };
  const message = e?.body?.message ?? e?.message ?? fallback;
  const status = typeof e?.status === 'number' ? e.status : 400;
  return new HttpError(status, 'AUTH_API_ERROR', message);
}
