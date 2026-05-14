import { isHttpError } from '@sveltejs/kit';

export function getErrorMessage(e: unknown, fallback: string): string {
	if (isHttpError(e)) return e.body.message;
	if (e instanceof Error) return e.message;
	return fallback;
}
