import { logger } from '../lib/logger.js';

const GITHUB_API = 'https://api.github.com';

export async function userIsInAllowedOrg(
	accessToken: string,
	allowedOrgs: string[]
): Promise<boolean> {
	if (allowedOrgs.length === 0) return false;

	for (const org of allowedOrgs) {
		try {
			const res = await fetch(`${GITHUB_API}/user/memberships/orgs/${encodeURIComponent(org)}`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
					'User-Agent': 'rootprint'
				}
			});
			// 404/403 => not a member (or org hidden from token); try the next org.
			if (res.status === 404 || res.status === 403) continue;
			if (!res.ok) {
				logger.error(
					{ org, statusCode: res.status },
					'github org check returned unexpected status'
				);
				continue;
			}
			const body = (await res.json()) as { state?: string };
			if (body.state === 'active') return true;
		} catch (err) {
			logger.error({ err, org }, 'github org check failed');
		}
	}
	return false;
}
