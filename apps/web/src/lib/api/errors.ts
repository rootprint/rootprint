import type * as v from 'valibot';

import type { ApiErrorBody } from 'api/types';

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
		if (d.path && d.path !== '(root)') out[d.path] = d.message;
	}
	return out;
}

/** Maps Valibot `safeParse` issues to a `{ field: message }` record keyed by top-level path. */
export function issuesToFieldErrors(
	issues: readonly v.BaseIssue<unknown>[]
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of issues) {
		const key = issue.path?.[0]?.key as string | undefined;
		if (key) out[key] = issue.message;
	}
	return out;
}

export function issuesToPathErrors(
	issues: readonly v.BaseIssue<unknown>[]
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const issue of issues) {
		const key = (issue.path ?? []).map((segment) => String(segment.key)).join('.') || '(root)';
		if (!(key in out)) out[key] = issue.message;
	}
	return out;
}

export function isAbortError(e: unknown): boolean {
	return (e instanceof DOMException || e instanceof Error) && e.name === 'AbortError';
}
