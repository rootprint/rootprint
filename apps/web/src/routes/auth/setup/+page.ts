import type { PageLoad } from './$types';
import { listAuthProviders, verifyInvite } from '$lib/api/auth';

export const load: PageLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const [result, providers] = await Promise.all([
		token ? verifyInvite(token) : { status: 'invalid' as const },
		listAuthProviders()
	]);
	return {
		providers,
		tokenStatus: result.status,
		token,
		email: result.status === 'valid' ? result.email : ''
	};
};
