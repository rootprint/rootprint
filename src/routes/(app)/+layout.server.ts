import { listIndexesForUser } from '$lib/server/services/index.service';

export const load = async (event) => {
	const indexes = await listIndexesForUser(event.locals.user?.role);
	return { indexes };
};
