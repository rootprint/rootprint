import type { PageServerLoad } from './$types';
import { validateInviteToken } from '$lib/server/services/auth.service';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		return { tokenStatus: 'invalid_token' as const };
	}

	const tokenStatus = await validateInviteToken(token);
	return { tokenStatus };
};
