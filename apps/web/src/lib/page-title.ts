import { resolveBreadcrumbs, routeKey } from '$lib/settings-nav';

const APP_NAME = 'Rootprint';

/** Titles for routes outside the settings breadcrumb manifest; settings pages derive theirs from the breadcrumb trail so the two never drift. */
const STATIC_TITLES: Record<string, string> = {
	'/': 'Logs',
	'/s/[code]': 'Shared log',
	'/auth/sign-in': 'Sign in',
	'/auth/setup': 'Setup',
	'/auth/setup-admin': 'Admin setup'
};

/** Resolve the browser tab title: settings pages reuse the trailing breadcrumb segment, others fall back to {@link STATIC_TITLES}, unknown routes get the bare app name. */
export function resolveTitle(
	routeId: string | null,
	params: Record<string, string | undefined> = {}
): string {
	if (!routeId) return APP_NAME;
	const pageName =
		resolveBreadcrumbs(routeId, params).at(-1)?.label ?? STATIC_TITLES[routeKey(routeId)];
	return pageName ? `${pageName} · ${APP_NAME}` : APP_NAME;
}
