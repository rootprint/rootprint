import type { PageLoad } from './$types';
import { listAuthProviders, verifyInvite } from '$lib/api/auth';

export const load: PageLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const [providers, result] = await Promise.all([
		listAuthProviders(),
		token ? verifyInvite(token) : { status: 'invalid' as const }
	]);
	const passwordEnabled = providers.password.enabled;
	return {
		tokenStatus: result.status,
		token,
		email: result.status === 'valid' ? result.email : '',
		passwordEnabled
	};
};
