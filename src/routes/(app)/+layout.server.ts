import { hasGoogleAccount } from '$lib/server/services/auth.service';
import { getIndexes } from '$lib/server/services/index.service';

export const load = async (event) => {
	const indexes = await getIndexes(event.locals.user?.role);
	const isGoogleUser = event.locals.user ? await hasGoogleAccount(event.locals.user.id) : false;
	return { indexes, isGoogleUser };
};
