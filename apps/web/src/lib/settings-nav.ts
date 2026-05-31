import {
	LayoutDashboard,
	Activity,
	Database,
	KeyRound,
	Send,
	Users,
	ShieldCheck
} from 'lucide-svelte';
import { integrationById } from '$lib/send-logs/integrations';
import type { BreadcrumbSegment } from '$lib/types';

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
export type NavGroup = { label: string; adminOnly: boolean; items: NavItem[] };

/** Settings sidebar nav tree. Shared with breadcrumbs so the two cannot drift. */
export const navGroups: NavGroup[] = [
	{
		label: 'Cluster',
		adminOnly: true,
		items: [
			{ href: '/settings/overview', label: 'Overview', icon: LayoutDashboard },
			{ href: '/settings/activity', label: 'Activity', icon: Activity }
		]
	},
	{
		label: 'Data',
		adminOnly: true,
		items: [
			{ href: '/settings/indexes', label: 'Indexes', icon: Database },
			{ href: '/settings/api-keys', label: 'API keys', icon: KeyRound },
			{ href: '/settings/send-logs', label: 'Send logs', icon: Send }
		]
	},
	{
		label: 'Security',
		adminOnly: true,
		items: [
			{ href: '/settings/users', label: 'Users', icon: Users },
			{ href: '/settings/authentication', label: 'Authentication', icon: ShieldCheck }
		]
	}
];

// Shared ancestor crumbs — defined once, reused across trails.
const ROOT: BreadcrumbSegment = { label: 'Settings', href: '/settings' };
const ACTIVITY: BreadcrumbSegment = { label: 'Activity', href: '/settings/activity' };
const INDEXES: BreadcrumbSegment = { label: 'Indexes', href: '/settings/indexes' };
const SEND_LOGS: BreadcrumbSegment = { label: 'Send logs', href: '/settings/send-logs' };
const AUTH: BreadcrumbSegment = { label: 'Authentication', href: '/settings/authentication' };

type Params = Record<string, string | undefined>;

/** Breadcrumb trails keyed by clean route pattern (`(group)` segments stripped). The only place breadcrumb structure lives — add new settings pages here. */
const TRAILS: Record<string, (params: Params) => BreadcrumbSegment[]> = {
	'/settings/overview': () => [ROOT, { label: 'Overview' }],
	'/settings/activity': () => [ROOT, { label: 'Activity' }],
	'/settings/activity/users/[userId]': () => [ROOT, ACTIVITY, { label: 'User' }],
	'/settings/activity/api-keys/[id]': () => [ROOT, ACTIVITY, { label: 'API key' }],
	'/settings/indexes': () => [ROOT, { label: 'Indexes' }],
	'/settings/indexes/[indexId]': (p) => [
		ROOT,
		INDEXES,
		{ label: p.indexId ?? 'Index', mono: true }
	],
	'/settings/api-keys': () => [ROOT, { label: 'API keys' }],
	'/settings/send-logs': () => [ROOT, { label: 'Send logs' }],
	'/settings/send-logs/[integration]': (p) => [
		ROOT,
		SEND_LOGS,
		{ label: integrationById.get(p.integration ?? '')?.label ?? 'Integration' }
	],
	'/settings/users': () => [ROOT, { label: 'Users' }],
	'/settings/authentication': () => [ROOT, { label: 'Authentication' }],
	'/settings/authentication/google': () => [ROOT, AUTH, { label: 'Google' }]
};

/** Strip SvelteKit `(group)` segments from a route id → clean URL pattern. */
export function routeKey(routeId: string): string {
	return routeId.replace(/\/\([^)]+\)/g, '');
}

/**
 * Resolve the breadcrumb trail for the current route. Returns `[]` for routes
 * not in the manifest (the presentational Breadcrumb then renders nothing).
 */
export function resolveBreadcrumbs(
	routeId: string | null,
	params: Params = {}
): BreadcrumbSegment[] {
	if (!routeId) return [];
	const build = TRAILS[routeKey(routeId)];
	return build ? build(params) : [];
}
