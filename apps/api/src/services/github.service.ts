import * as v from 'valibot';

const GITHUB_API = 'https://api.github.com';
const GITHUB_MEMBERSHIPS_PER_PAGE = 100;
const GITHUB_MEMBERSHIPS_MAX_PAGES = 10;
const GITHUB_REQUEST_TIMEOUT_MS = 5000;

const membershipsSchema = v.array(
	v.object({ organization: v.optional(v.object({ login: v.optional(v.string()) })) })
);

/**
 * False for a rejected token or a definitive non-membership; throws when GitHub
 * could not answer, with rate-limit diagnostics attached for the caller's log.
 */
export async function userIsInAllowedOrg(
	accessToken: string,
	allowedOrgs: string[]
): Promise<boolean> {
	if (allowedOrgs.length === 0) return false;
	const allowed = new Set(allowedOrgs.map((org) => org.toLowerCase()));
	const signal = AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS);

	// Pages are intentionally serial so normal sign-ins make only one request.
	/* oxlint-disable no-await-in-loop */
	for (let page = 1; page <= GITHUB_MEMBERSHIPS_MAX_PAGES; page += 1) {
		const url = new URL('/user/memberships/orgs', GITHUB_API);
		url.searchParams.set('state', 'active');
		url.searchParams.set('per_page', String(GITHUB_MEMBERSHIPS_PER_PAGE));
		url.searchParams.set('page', String(page));

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': 'rootprint'
			},
			redirect: 'error',
			signal
		});
		if (res.status === 401) return false;
		if (!res.ok) {
			throw Object.assign(new Error(`github org membership list failed (HTTP ${res.status})`), {
				page,
				rateLimited:
					res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after'),
				rateLimitReset: res.headers.get('x-ratelimit-reset')
			});
		}

		const memberships = v.parse(membershipsSchema, await res.json());
		if (
			memberships.some((membership) => {
				const login = membership.organization?.login;
				return login !== undefined && allowed.has(login.toLowerCase());
			})
		) {
			return true;
		}
		if (memberships.length < GITHUB_MEMBERSHIPS_PER_PAGE) return false;
	}
	/* oxlint-enable no-await-in-loop */

	throw new Error(
		`github org membership page limit reached (${GITHUB_MEMBERSHIPS_MAX_PAGES} pages)`
	);
}
