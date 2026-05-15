export const ROUTES = {
	home: '/',
	signIn: '/auth/sign-in',
	setupAdmin: '/auth/setup-admin'
} as const;

export const AUTH_PREFIX = '/auth';

export function signInPathWithReturnTo(currentPath: string): string {
	if (!currentPath || currentPath === ROUTES.home) return ROUTES.signIn;
	const returnTo = encodeURIComponent(currentPath);
	return `${ROUTES.signIn}?returnTo=${returnTo}`;
}

export function safeReturnTo(raw: string | null): string {
	if (!raw) return ROUTES.home;
	// Only allow relative paths beginning with a single '/'. Reject protocol-relative (`//host`).
	if (!raw.startsWith('/') || raw.startsWith('//')) return ROUTES.home;
	return raw;
}
