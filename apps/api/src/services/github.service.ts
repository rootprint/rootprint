import { logger } from '../lib/logger.js';

const GITHUB_API = 'https://api.github.com';
const GITHUB_MEMBERSHIPS_PER_PAGE = 100;
const GITHUB_MEMBERSHIPS_MAX_PAGES = 10;
const GITHUB_REQUEST_TIMEOUT_MS = 5000;

type GitHubMembership = {
	organization?: { login?: string };
};

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

		try {
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
			if (res.status === 401 || res.status === 404) return false;
			if (res.status === 403) {
				logger.warn(
					{
						statusCode: res.status,
						page,
						allowedOrgCount: allowed.size,
						rateLimited:
							res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after'),
						rateLimitReset: res.headers.get('x-ratelimit-reset')
					},
					'github org membership check forbidden'
				);
				return false;
			}
			if (!res.ok) {
				logger.error(
					{ statusCode: res.status, page, allowedOrgCount: allowed.size },
					'github org membership list failed'
				);
				return false;
			}

			const memberships = (await res.json()) as GitHubMembership[];
			if (
				memberships.some((membership) => {
					const login = membership.organization?.login;
					return login !== undefined && allowed.has(login.toLowerCase());
				})
			) {
				return true;
			}
			if (memberships.length < GITHUB_MEMBERSHIPS_PER_PAGE) return false;
		} catch (err) {
			logger.error(
				{ err, page, allowedOrgCount: allowed.size },
				'github org membership list failed'
			);
			return false;
		}
	}
	/* oxlint-enable no-await-in-loop */

	logger.warn(
		{ maxPages: GITHUB_MEMBERSHIPS_MAX_PAGES, allowedOrgCount: allowed.size },
		'github org membership page limit reached'
	);
	return false;
}
