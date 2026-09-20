const BASE = 'https://return-to.invalid';

/**
 * Keep only same-origin relative paths outside `/auth`. Resolved rather than prefix-checked because
 * the parser folds `\` into `/` and strips tabs: `/\evil.com` is offsite despite starting with a
 * single slash. `/auth/*` is refused because every caller uses the result as a post-sign-in
 * destination, and `?returnTo=/auth/sign-in` would otherwise redirect the page back to itself.
 */
export function safeReturnTo(raw: string | null): string {
	if (!raw) return '/';
	try {
		const url = new URL(raw, BASE);
		if (url.origin !== BASE) return '/';
		if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) return '/';
		return url.pathname + url.search + url.hash;
	} catch {
		return '/';
	}
}
