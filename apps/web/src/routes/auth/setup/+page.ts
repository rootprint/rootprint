import type { PageLoad } from './$types';
import { verifyInvite } from '$lib/api/auth';

export const load: PageLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	if (!token) {
		return { tokenStatus: 'invalid' as const, token: '', email: '' };
	}

	const result = await verifyInvite(token);
	return {
		tokenStatus: result.status,
		token,
		email: result.status === 'valid' ? result.email : ''
	};
};
