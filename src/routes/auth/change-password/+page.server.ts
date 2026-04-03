import { redirect } from '@sveltejs/kit';

import { requireUser } from '$lib/middleware/auth';
import { hasGoogleAccount } from '$lib/server/services/auth.service';

export async function load() {
	const currentUser = requireUser();
	if (await hasGoogleAccount(currentUser.id)) {
		redirect(303, '/');
	}
}
