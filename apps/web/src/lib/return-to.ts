const BASE = 'https://return-to.invalid';

/**
 * Keep only same-origin relative paths. Resolved rather than prefix-checked because the parser folds
 * `\` into `/` and strips tabs: `/\evil.com` is offsite despite starting with a single slash.
 */
export function safeReturnTo(raw: string | null): string {
	if (!raw) return '/';
	try {
		const url = new URL(raw, BASE);
		if (url.origin !== BASE) return '/';
		return url.pathname + url.search + url.hash;
	} catch {
		return '/';
	}
}
