import type { PageLoad } from './$types';
import { verifyInvite } from '$lib/api/auth';

export const load: PageLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	const result = token ? await verifyInvite(token) : { status: 'invalid' as const };
	return {
		tokenStatus: result.status,
		token,
		email: result.status === 'valid' ? result.email : ''
	};
};
